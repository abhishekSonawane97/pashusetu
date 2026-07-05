// Moderation repository — docs/09-backend §2, admin queries + state transitions
// for API-25/26/27. Every mutation is one interactive transaction that pairs the
// status change with exactly one moderation_log row (BR-046). Transitions use a
// status precondition in the WHERE (BR-033) so two admins can't double-decide.

import type { Prisma, ListingStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { CursorKey } from '@/lib/api/cursor'

// Rich projection for the moderation queue (doc 08 API-25): full listing +
// ordered images + seller summary WITH phone (BR-066 admin exception) + open
// report count + the stored duplicate flag.
const adminInclude = {
  breed: { select: { id: true, species: true, nameEn: true, nameMr: true } },
  district: { select: { id: true, nameEn: true, nameMr: true, state: true } },
  images: {
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true, url: true, width: true, height: true },
  },
  seller: {
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      createdAt: true,
      district: { select: { id: true, nameEn: true, nameMr: true, state: true } },
    },
  },
  _count: { select: { reports: { where: { status: 'OPEN' } } } },
} satisfies Prisma.ListingInclude

export type AdminListingRow = Prisma.ListingGetPayload<{ include: typeof adminInclude }>

/**
 * API-25 queue: PENDING → oldest-first FIFO by updated_at (BR-040); every other
 * status → created_at desc. Keyset on (sortKey, id); fetch limit+1 sentinel.
 */
export async function adminList(
  status: ListingStatus,
  after: [CursorKey, string] | null,
  limit: number,
): Promise<AdminListingRow[]> {
  const fifo = status === 'PENDING'
  const orderBy: Prisma.ListingOrderByWithRelationInput[] = fifo
    ? [{ updatedAt: 'asc' }, { id: 'asc' }]
    : [{ createdAt: 'desc' }, { id: 'desc' }]

  let keyset: Prisma.ListingWhereInput = {}
  if (after) {
    const d = new Date(String(after[0]))
    keyset = fifo
      ? { OR: [{ updatedAt: { gt: d } }, { updatedAt: d, id: { gt: after[1] } }] }
      : { OR: [{ createdAt: { lt: d } }, { createdAt: d, id: { lt: after[1] } }] }
  }

  return prisma.listing.findMany({
    where: { status, ...keyset },
    orderBy,
    take: limit + 1,
    include: adminInclude,
  })
}

/** Per-seller aggregates for the queue cards (priorListingCount, rejectionCount). */
export async function sellerStats(
  sellerIds: string[],
): Promise<Map<string, { total: number; rejected: number }>> {
  const map = new Map<string, { total: number; rejected: number }>()
  if (sellerIds.length === 0) return map
  const grouped = await prisma.listing.groupBy({
    by: ['sellerId', 'status'],
    where: { sellerId: { in: sellerIds } },
    _count: { _all: true },
  })
  for (const g of grouped) {
    const entry = map.get(g.sellerId) ?? { total: 0, rejected: 0 }
    entry.total += g._count._all
    if (g.status === 'REJECTED') entry.rejected += g._count._all
    map.set(g.sellerId, entry)
  }
  return map
}

// Tagged result so the service maps each guard to the right AppError (doc 08
// API-26/27 error tables) without the repo importing the error layer.
export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' }
  | { ok: false; reason: 'NOT_PENDING'; from: ListingStatus }
  | { ok: false; reason: 'STALE_REVIEW' }
  | { ok: false; reason: 'SELLER_BANNED' }
  | { ok: false; reason: 'OPEN_REPORTS' }

// Shared pre-transition guards (both approve and reject need the exact same set).
async function guard(
  tx: Prisma.TransactionClient,
  id: string,
  expectedUpdatedAt: Date,
): Promise<TransitionResult> {
  const row = await tx.listing.findUnique({
    where: { id },
    select: {
      status: true,
      updatedAt: true,
      seller: { select: { status: true } },
      _count: { select: { reports: { where: { status: 'OPEN' } } } },
    },
  })
  if (!row) return { ok: false, reason: 'NOT_FOUND' }
  if (row.status !== 'PENDING') return { ok: false, reason: 'NOT_PENDING', from: row.status }
  if (row.updatedAt.getTime() !== expectedUpdatedAt.getTime())
    return { ok: false, reason: 'STALE_REVIEW' }
  if (row.seller.status !== 'ACTIVE') return { ok: false, reason: 'SELLER_BANNED' }
  if (row._count.reports > 0) return { ok: false, reason: 'OPEN_REPORTS' }
  return { ok: true }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/** API-26 / T-03: PENDING → APPROVED, fresh 30-day expiry, + APPROVE log row. */
export async function approveTransition(
  id: string,
  adminId: string,
  expectedUpdatedAt: Date,
): Promise<TransitionResult> {
  return prisma.$transaction(async (tx) => {
    const g = await guard(tx, id, expectedUpdatedAt)
    if (!g.ok) return g
    const now = new Date()
    const res = await tx.listing.updateMany({
      where: { id, status: 'PENDING' }, // precondition (BR-033) — loses a concurrent race → count 0
      data: {
        status: 'APPROVED',
        approvedAt: now,
        expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS),
      },
    })
    if (res.count === 0) return { ok: false, reason: 'NOT_PENDING', from: 'PENDING' }
    await tx.moderationLog.create({ data: { adminId, listingId: id, action: 'APPROVE' } })
    return { ok: true }
  })
}

/** API-27 / T-04: PENDING → REJECTED; reason code stored on the listing + full
 *  reason (code + optional detail) recorded in the moderation_log (BR-043/046). */
export async function rejectTransition(
  id: string,
  adminId: string,
  reasonCode: string,
  detail: string | undefined,
  expectedUpdatedAt: Date,
): Promise<TransitionResult> {
  return prisma.$transaction(async (tx) => {
    const g = await guard(tx, id, expectedUpdatedAt)
    if (!g.ok) return g
    const res = await tx.listing.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', rejectionReason: reasonCode },
    })
    if (res.count === 0) return { ok: false, reason: 'NOT_PENDING', from: 'PENDING' }
    await tx.moderationLog.create({
      data: {
        adminId,
        listingId: id,
        action: 'REJECT',
        reason: detail ? `${reasonCode}: ${detail}` : reasonCode,
      },
    })
    return { ok: true }
  })
}

/** Core fields for the transition response (doc 08 API-26/27 return the listing). */
export async function transitionResult(id: string) {
  return prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      approvedAt: true,
      expiresAt: true,
      rejectionReason: true,
      updatedAt: true,
    },
  })
}
