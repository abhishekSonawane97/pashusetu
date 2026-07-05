// Moderation service — docs/08-api API-25/26/27 business logic. Builds the admin
// queue item (ListingDetail + seller-with-phone + moderation metadata), maps the
// repo's tagged transition results to the exact AppError codes, and enforces the
// optimistic-review guard. Admin identity is verified upstream (requireAdmin).

import { AppError } from '@/lib/errors/app-error'
import { decodeCursor, encodeCursor, type CursorKey } from '@/lib/api/cursor'
import { containsPhoneNumber } from '@/lib/validation/common'
import type { AuthContext } from '@/lib/auth/auth-context'
import type { ListingStatus } from '@prisma/client'
import * as moderationRepo from '@/lib/repositories/moderation-repo'
import type { AdminListingRow, TransitionResult } from '@/lib/repositories/moderation-repo'
import type { RejectReason } from '@/lib/validation/admin'

// ListingImage.url is the variant base (doc 09 §7); named URLs append the file.
function imageUrls(base: string) {
  return { thumb: `${base}/thumb.webp`, card: `${base}/card.webp`, detail: `${base}/detail.webp` }
}

function buildAdminItem(
  row: AdminListingRow,
  stats: { total: number; rejected: number },
  now: number,
): Record<string, unknown> {
  const pendingSince = row.status === 'PENDING' ? row.updatedAt : null
  return {
    id: row.id,
    status: row.status,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    ageMonths: row.ageMonths,
    weightKg: row.weightKg,
    milkYieldLpd: row.milkYieldLpd == null ? null : Number(row.milkYieldLpd),
    lactationNumber: row.lactationNumber,
    isPregnant: row.isPregnant,
    isVaccinated: row.isVaccinated,
    priceInr: row.priceInr,
    negotiable: row.negotiable,
    description: row.description,
    district: row.district,
    taluka: row.taluka,
    village: row.village,
    images: row.images.map((img) => ({
      id: img.id,
      sortOrder: img.sortOrder,
      width: img.width,
      height: img.height,
      urls: imageUrls(img.url),
    })),
    declarationAccepted: row.declarationAccepted,
    declarationAt: row.declarationAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    // Admin sees the seller's phone (BR-066 exception) — the only surface that does.
    seller: {
      id: row.seller.id,
      name: row.seller.name,
      phone: row.seller.phone,
      district: row.seller.district,
      status: row.seller.status,
      joinedAt: row.seller.createdAt.toISOString(),
      priorListingCount: stats.total,
      priorRejectionCount: stats.rejected,
    },
    moderation: {
      pendingSince: pendingSince?.toISOString() ?? null,
      queueAgeHours: pendingSince ? (now - pendingSince.getTime()) / 3_600_000 : null,
      duplicateOfListingId: row.duplicateOfId,
      possibleContactInfo: row.description ? containsPhoneNumber(row.description) : false,
      openReportCount: row._count.reports,
      rejectionCount: stats.rejected,
      autoHidden: false, // set by T-10 (reports slice); default until reports land
    },
  }
}

/** API-25 — moderation queue / status browser (admin only, keyset paginated). */
export async function listQueue(status: ListingStatus, cursor: string | undefined, limit: number) {
  let after: [CursorKey, string] | null = null
  if (cursor) {
    after = decodeCursor(cursor)
    if (!after) throw AppError.validation({ cursor: 'malformed cursor' }, { malformed: true })
  }

  const rows = await moderationRepo.adminList(status, after, limit)
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const stats = await moderationRepo.sellerStats([...new Set(page.map((r) => r.sellerId))])
  const now = Date.now()
  const items = page.map((r) =>
    buildAdminItem(r, stats.get(r.sellerId) ?? { total: 0, rejected: 0 }, now),
  )

  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor(
          (status === 'PENDING' ? last.updatedAt : last.createdAt).toISOString(),
          last.id,
        )
      : null

  return { items, nextCursor }
}

// Map the repo's tagged failure to the doc 08 API-26/27 error table.
function throwTransitionError(res: Exclude<TransitionResult, { ok: true }>, action: string): never {
  switch (res.reason) {
    case 'NOT_FOUND':
      throw AppError.listingNotFound()
    case 'NOT_PENDING':
      throw AppError.invalidStateTransition(res.from, action)
    case 'STALE_REVIEW':
    case 'SELLER_BANNED':
    case 'OPEN_REPORTS':
      throw AppError.conflict({ reason: res.reason })
  }
}

function serializeTransition(
  row: NonNullable<Awaited<ReturnType<typeof moderationRepo.transitionResult>>>,
) {
  return {
    id: row.id,
    status: row.status,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** API-26 / T-03 — approve a PENDING listing. */
export async function approve(ctx: AuthContext, id: string, expectedUpdatedAt: string) {
  const res = await moderationRepo.approveTransition(id, ctx.user.id, new Date(expectedUpdatedAt))
  if (!res.ok) throwTransitionError(res, 'approve')
  const row = await moderationRepo.transitionResult(id)
  return serializeTransition(row!)
}

/** API-27 / T-04 — reject a PENDING listing with a mandatory BR-043 reason. */
export async function reject(
  ctx: AuthContext,
  id: string,
  reason: RejectReason,
  detail: string | undefined,
  expectedUpdatedAt: string,
) {
  const res = await moderationRepo.rejectTransition(
    id,
    ctx.user.id,
    reason,
    detail,
    new Date(expectedUpdatedAt),
  )
  if (!res.ok) throwTransitionError(res, 'reject')
  const row = await moderationRepo.transitionResult(id)
  return serializeTransition(row!)
}
