// Listing repository — Prisma queries only (doc 09 §2). Search is keyset-
// paginated (doc 08 §4.2): fetch limit+1 to know if there's a next page.

import type { Prisma, ListingStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { CursorKey } from '@/lib/api/cursor'
import type { SearchQuery } from '@/lib/validation/search'

// The ListingCard field projection (doc 08 §4.4) — deliberately light for 3G.
const cardSelect = {
  id: true,
  species: true,
  sex: true,
  ageMonths: true,
  priceInr: true,
  negotiable: true,
  isPregnant: true,
  milkYieldLpd: true,
  taluka: true,
  village: true,
  approvedAt: true,
  createdAt: true,
  breed: { select: { id: true, species: true, nameEn: true, nameMr: true } },
  district: { select: { id: true, nameEn: true, nameMr: true, state: true } },
  images: {
    where: { sortOrder: 0 },
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.ListingSelect

export type ListingCardRow = Prisma.ListingGetPayload<{ select: typeof cardSelect }>

function orderBy(sort: SearchQuery['sort']): Prisma.ListingOrderByWithRelationInput[] {
  // Keyset order matches doc 08 §4.2. `newest` ranks by created_at (anti-gaming,
  // doc 07 §4.1) — NOT approved_at, so renewals/re-approvals can't bump to top.
  if (sort === 'price_asc') return [{ priceInr: 'asc' }, { id: 'asc' }]
  if (sort === 'price_desc') return [{ priceInr: 'desc' }, { id: 'desc' }]
  return [{ createdAt: 'desc' }, { id: 'desc' }]
}

// Keyset WHERE for "rows strictly after (key, id)" in the sort's direction.
function keysetWhere(
  sort: SearchQuery['sort'],
  key: CursorKey,
  id: string,
): Prisma.ListingWhereInput {
  if (sort === 'price_asc') {
    const p = Number(key)
    return { OR: [{ priceInr: { gt: p } }, { priceInr: p, id: { gt: id } }] }
  }
  if (sort === 'price_desc') {
    const p = Number(key)
    return { OR: [{ priceInr: { lt: p } }, { priceInr: p, id: { lt: id } }] }
  }
  const d = new Date(String(key))
  return { OR: [{ createdAt: { lt: d } }, { createdAt: d, id: { lt: id } }] }
}

export async function searchApproved(
  query: SearchQuery,
  after: [CursorKey, string] | null,
): Promise<ListingCardRow[]> {
  const where: Prisma.ListingWhereInput = {
    status: 'APPROVED', // visibility rule (doc 08 §4.3) — everyone, always
    ...(query.species ? { species: query.species } : {}),
    ...(query.breedId ? { breedId: query.breedId } : {}),
    ...(query.districtId ? { districtId: query.districtId } : {}),
    ...(query.taluka ? { taluka: query.taluka } : {}),
    ...(query.sellerId ? { sellerId: query.sellerId } : {}),
    ...(query.minPrice != null || query.maxPrice != null
      ? {
          priceInr: {
            ...(query.minPrice != null && { gte: query.minPrice }),
            ...(query.maxPrice != null && { lte: query.maxPrice }),
          },
        }
      : {}),
    ...(after ? keysetWhere(query.sort, after[0], after[1]) : {}),
  }

  return prisma.listing.findMany({
    where,
    orderBy: orderBy(query.sort),
    take: query.limit + 1, // +1 sentinel to detect a next page
    select: cardSelect,
  })
}

export { cardSelect }

/**
 * Distinct talukas (tehsils) present on APPROVED listings — powers the browse
 * taluka filter. Optionally scoped to a district (the filter fetches this when a
 * district is chosen). Taluka is free-text (BR-022), so these are the real values
 * sellers have used, not a canonical list.
 */
export async function distinctTalukas(districtId?: string): Promise<string[]> {
  const rows = await prisma.listing.findMany({
    where: { status: 'APPROVED', taluka: { not: null }, ...(districtId ? { districtId } : {}) },
    select: { taluka: true },
    distinct: ['taluka'],
    orderBy: { taluka: 'asc' },
  })
  return rows.map((r) => r.taluka).filter((t): t is string => !!t)
}

// Full detail projection (doc 08 ListingDetail): all attributes + ordered images
// + seller summary. Seller phone is NEVER selected (BR-066) — only API-21 reveals it.
const detailInclude = {
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
      village: true,
      createdAt: true,
      district: { select: { id: true, nameEn: true, nameMr: true, state: true } },
    },
  },
} satisfies Prisma.ListingInclude

export type ListingDetailRow = Prisma.ListingGetPayload<{ include: typeof detailInclude }>

export async function findDetailById(id: string): Promise<ListingDetailRow | null> {
  return prisma.listing.findUnique({ where: { id }, include: detailInclude })
}

/** Count of the seller's currently-APPROVED listings (ListingDetail.seller.activeListingCount). */
export function countApprovedBySeller(sellerId: string): Promise<number> {
  return prisma.listing.count({ where: { sellerId, status: 'APPROVED' } })
}

/** Is this listing in the caller's favorites? (viewer.isFavorited) */
export async function isFavorited(userId: string, listingId: string): Promise<boolean> {
  const fav = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId, listingId } },
  })
  return fav !== null
}

/** BR-034: +1 view on every public fetch of an APPROVED listing; no dedup in MVP. */
export function incrementViewCount(id: string): Promise<unknown> {
  return prisma.listing.update({ where: { id }, data: { viewCount: { increment: 1 } } })
}

// Non-terminal statuses count toward the BR-024 active quota (SOLD/ARCHIVED are terminal).
export const ACTIVE_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] as const

/**
 * Create a DRAFT with the active-listing quota (BR-024, max 10) enforced
 * ATOMICALLY inside the same transaction (doc 08 API-08) — count + insert under
 * one interactive tx so two concurrent creates can't both slip past the cap.
 */
export type DraftInput = Omit<Prisma.ListingUncheckedCreateInput, 'sellerId' | 'status' | 'id'>

export async function createDraftWithQuota(
  sellerId: string,
  data: DraftInput,
  limit: number,
): Promise<{ created: ListingDetailRow | null; activeCount: number }> {
  return prisma.$transaction(async (tx) => {
    const activeCount = await tx.listing.count({
      where: { sellerId, status: { in: ACTIVE_STATUSES as unknown as ListingStatus[] } },
    })
    if (activeCount >= limit) return { created: null, activeCount }
    const created = await tx.listing.create({
      data: { ...data, sellerId, status: 'DRAFT' },
      include: detailInclude,
    })
    return { created, activeCount }
  })
}

export async function findOwned(id: string): Promise<ListingDetailRow | null> {
  return findDetailById(id)
}

export async function countImages(listingId: string): Promise<number> {
  return prisma.listingImage.count({ where: { listingId } })
}

/**
 * Attach an image with the ≤5 photo cap (BR-023) enforced atomically: count +
 * insert (sort_order = current count, cover = 0) in one tx. Returns null if the
 * listing is already at the limit.
 */
export async function addImageWithLimit(
  listingId: string,
  data: { r2Key: string; url: string; width: number; height: number },
  limit: number,
): Promise<{ imageId: string; sortOrder: number } | null> {
  return prisma.$transaction(async (tx) => {
    const count = await tx.listingImage.count({ where: { listingId } })
    if (count >= limit) return null
    const img = await tx.listingImage.create({
      data: { listingId, ...data, sortOrder: count },
      select: { id: true, sortOrder: true },
    })
    return { imageId: img.id, sortOrder: img.sortOrder }
  })
}

export function findImage(listingId: string, imageId: string) {
  return prisma.listingImage.findFirst({ where: { id: imageId, listingId } })
}

export async function deleteImageRow(imageId: string): Promise<void> {
  await prisma.listingImage.delete({ where: { id: imageId } })
}

/**
 * Submit transition T-02 (DRAFT→PENDING) / T-05 (REJECTED→PENDING) with a
 * status precondition in the WHERE clause (BR-033) so concurrent requests can't
 * double-fire. Returns null if the row wasn't in a submittable state.
 */
export async function submitTransition(
  id: string,
  duplicateOfId: string | null,
): Promise<ListingDetailRow | null> {
  const res = await prisma.listing.updateMany({
    where: { id, status: { in: ['DRAFT', 'REJECTED'] } },
    data: {
      status: 'PENDING',
      declarationAccepted: true,
      declarationAt: new Date(),
      rejectionReason: null, // T-05 clears it; harmless no-op for T-02
      duplicateOfId,
    },
  })
  if (res.count === 0) return null
  return findDetailById(id)
}

export async function patchListing(
  id: string,
  data: Prisma.ListingUpdateInput,
): Promise<ListingDetailRow | null> {
  await prisma.listing.update({ where: { id }, data })
  return findDetailById(id)
}

/**
 * T-09 for photo edits (BR-028): a photo attach/delete on an APPROVED listing
 * sends it back to moderation (hidden), re-affirming the declaration. Guarded on
 * status=APPROVED so it only fires for live listings (DRAFT/PENDING/REJECTED keep
 * their status). Idempotent.
 */
export async function markPendingForEdit(id: string): Promise<void> {
  await prisma.listing.updateMany({
    where: { id, status: 'APPROVED' },
    data: { status: 'PENDING', declarationAt: new Date() },
  })
}

/**
 * API-09 imageOrder: reassign sort_order 0..n-1 from a permutation of the
 * listing's CURRENT image ids (cover = index 0). Returns false without changes
 * if `orderedIds` is not an exact permutation (service maps → VALIDATION_ERROR).
 */
export async function reorderImages(listingId: string, orderedIds: string[]): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.listingImage.findMany({ where: { listingId }, select: { id: true } })
    const currentIds = new Set(current.map((i) => i.id))
    const sameSet =
      orderedIds.length === currentIds.size && orderedIds.every((id) => currentIds.has(id))
    if (!sameSet) return false
    // Two-phase to dodge the unique (listing_id, sort_order) collision: offset, then set.
    await Promise.all(
      orderedIds.map((imgId, i) =>
        tx.listingImage.update({ where: { id: imgId }, data: { sortOrder: i + 1000 } }),
      ),
    )
    await Promise.all(
      orderedIds.map((imgId, i) =>
        tx.listingImage.update({ where: { id: imgId }, data: { sortOrder: i } }),
      ),
    )
    return true
  })
}

/** BR-029 duplicate heuristic (advisory): same seller + species + price ±10% within 7 days. */
export async function findDuplicate(
  sellerId: string,
  species: string,
  priceInr: number,
  excludeId: string,
): Promise<string | null> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  const match = await prisma.listing.findFirst({
    where: {
      sellerId,
      species: species as never,
      id: { not: excludeId },
      createdAt: { gte: since },
      priceInr: { gte: Math.floor(priceInr * 0.9), lte: Math.ceil(priceInr * 1.1) },
    },
    select: { id: true },
  })
  return match?.id ?? null
}

// API-14 My Listings: own listings by status, keyset (created_at, id) desc, + quota meta.
export async function ownListings(
  sellerId: string,
  status: string | undefined,
  after: [CursorKey, string] | null,
  limit: number,
): Promise<{ rows: OwnListingRow[]; activeCount: number }> {
  const where: Prisma.ListingWhereInput = {
    sellerId,
    ...(status ? { status: status as never } : {}),
    ...(after
      ? {
          OR: [
            { createdAt: { lt: new Date(String(after[0])) } },
            { createdAt: new Date(String(after[0])), id: { lt: after[1] } },
          ],
        }
      : {}),
  }
  const [rows, activeCount] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        ...cardSelect,
        status: true,
        rejectionReason: true,
        expiresAt: true,
        soldAt: true,
        viewCount: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { images: true, interestEvents: true } },
      },
    }),
    prisma.listing.count({
      where: { sellerId, status: { in: ACTIVE_STATUSES as unknown as ListingStatus[] } },
    }),
  ])
  return { rows: rows as OwnListingRow[], activeCount }
}

export type OwnListingRow = ListingCardRow & {
  status: string
  rejectionReason: string | null
  expiresAt: Date | null
  soldAt: Date | null
  viewCount: number
  updatedAt: Date
  _count: { images: number; interestEvents: number }
}
