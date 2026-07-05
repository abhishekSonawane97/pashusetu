// Listing service — search business logic (doc 08 §4). Validates the
// breed/species relationship and district existence against the DB (F-04 AC-3),
// maps rows to the ListingCard wire shape, and builds the keyset cursor.

import { AppError } from '@/lib/errors/app-error'
import { decodeCursor, encodeCursor, type CursorKey } from '@/lib/api/cursor'
import type { ListingCard, Paginated } from '@/lib/api/types'
import type { SearchQuery } from '@/lib/validation/search'
import type { AuthContext } from '@/lib/auth/auth-context'
import * as listingRepo from '@/lib/repositories/listing-repo'
import type { ListingCardRow, OwnListingRow } from '@/lib/repositories/listing-repo'
import { containsPhoneNumber } from '@/lib/validation/common'
import { listingFieldIssues, type CreateListingInput } from '@/lib/validation/listings'
import { prisma } from '@/lib/prisma'

function toCard(row: ListingCardRow): ListingCard {
  return {
    id: row.id,
    species: row.species,
    breed: row.breed!, // APPROVED listings always have breed set (BR-022 submit guard)
    sex: row.sex!,
    ageMonths: row.ageMonths!,
    priceInr: row.priceInr!,
    negotiable: row.negotiable,
    isPregnant: row.isPregnant,
    milkYieldLpd: row.milkYieldLpd == null ? null : Number(row.milkYieldLpd),
    district: row.district!,
    taluka: row.taluka,
    village: row.village!,
    thumbnailUrl: row.images[0]?.url ?? null,
    approvedAt: row.approvedAt!.toISOString(),
  }
}

function cursorKeyFor(sort: SearchQuery['sort'], row: ListingCardRow): CursorKey {
  if (sort === 'price_asc' || sort === 'price_desc') return row.priceInr!
  return row.createdAt.toISOString()
}

// Three named URLs per doc 08 ListingDetail image shape. Until the R2 image
// pipeline (doc 09 §7, account-gated) generates distinct variants, all three
// point at the stored URL — the contract shape is honored now, the variant
// bytes land with the pipeline slice.
function imageUrls(url: string) {
  return { thumb: url, card: url, detail: url }
}

type DetailRow = import('@/lib/repositories/listing-repo').ListingDetailRow

// Shared ListingDetail serializer (doc 08 §1.9) — used by the public read path
// and by every owner write op. Owner/admin get the 6 extension fields; the
// public never sees them. Seller is first-name-only, never a phone (BR-066).
function buildDetail(
  row: DetailRow,
  opts: { isOwner: boolean; isAdmin: boolean; isFavorited: boolean; viewerPresent: boolean; activeListingCount: number },
): Record<string, unknown> {
  const privileged = opts.isOwner || opts.isAdmin
  const detail: Record<string, unknown> = {
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
    viewCount: row.viewCount,
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    seller: {
      id: row.seller.id,
      firstName: row.seller.name.trim().split(/\s+/)[0], // first name only (BR-066)
      village: row.seller.village,
      district: row.seller.district,
      memberSince: row.seller.createdAt.toISOString().slice(0, 7), // YYYY-MM
      activeListingCount: opts.activeListingCount,
    },
    viewer: opts.viewerPresent ? { isOwner: opts.isOwner, isFavorited: opts.isFavorited } : null,
  }
  if (privileged) {
    detail.rejectionReason = row.rejectionReason
    detail.expiresAt = row.expiresAt?.toISOString() ?? null
    detail.soldAt = row.soldAt?.toISOString() ?? null
    detail.declarationAccepted = row.declarationAccepted
    detail.declarationAt = row.declarationAt?.toISOString() ?? null
    detail.updatedAt = row.updatedAt.toISOString()
  }
  return detail
}

export async function getDetail(id: string, viewer: AuthContext | null) {
  const row = await listingRepo.findDetailById(id)
  if (!row) throw AppError.listingNotFound()

  const isOwner = viewer?.user.id === row.sellerId
  const isAdmin = viewer?.user.isAdmin ?? false
  const privileged = isOwner || isAdmin

  // Visibility (doc 08 §4.3 / BR-034): non-APPROVED is 404 to the public. SOLD
  // carries publicState so S-07 can show the sold banner; other hidden statuses
  // never confirm existence beyond "unavailable".
  if (row.status !== 'APPROVED' && !privileged) {
    throw AppError.listingNotFound(row.status === 'SOLD' ? 'SOLD' : 'UNAVAILABLE')
  }

  // +1 view only on public fetches of APPROVED listings (BR-034); owner/admin never.
  if (row.status === 'APPROVED' && !privileged) {
    await listingRepo.incrementViewCount(id)
  }

  const activeListingCount = await listingRepo.countApprovedBySeller(row.sellerId)
  const isFavorited = viewer ? await listingRepo.isFavorited(viewer.user.id, id) : false

  return buildDetail(row, { isOwner, isAdmin, isFavorited, viewerPresent: !!viewer, activeListingCount })
}

export async function search(query: SearchQuery): Promise<Paginated<ListingCard>> {
  // Relationship checks (doc 08 §4.1): unknown/mismatched refs are malformed → 400.
  if (query.breedId) {
    const breed = await prisma.breed.findUnique({ where: { id: query.breedId } })
    if (!breed) throw AppError.validation({ breedId: 'unknown breed' }, { malformed: true })
    if (query.species && breed.species !== query.species) {
      throw AppError.validation(
        { breedId: 'breed does not belong to species' },
        { malformed: true },
      )
    }
  }
  if (query.districtId) {
    const district = await prisma.district.findUnique({ where: { id: query.districtId } })
    if (!district)
      throw AppError.validation({ districtId: 'unknown district' }, { malformed: true })
  }

  let after: [CursorKey, string] | null = null
  if (query.cursor) {
    after = decodeCursor(query.cursor)
    if (!after) throw AppError.validation({ cursor: 'malformed cursor' }, { malformed: true })
  }

  const rows = await listingRepo.searchApproved(query, after)
  const hasMore = rows.length > query.limit
  const page = hasMore ? rows.slice(0, query.limit) : rows
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(cursorKeyFor(query.sort, last), last.id) : null

  return { items: page.map(toCard), nextCursor }
}

// ---------------- Write path (state machine, doc 04 BR-03x) ----------------

const ACTIVE_LIMIT = 10 // BR-024

function assertOwner(row: { sellerId: string }, ctx: AuthContext): void {
  if (row.sellerId !== ctx.user.id) throw AppError.forbidden()
}

/** API-08 / T-01: create a DRAFT with the atomic active-listing quota (BR-024). */
export async function createDraft(ctx: AuthContext, input: CreateListingInput) {
  // Only provided fields are written; the rest stay null until the wizard fills them.
  const { negotiable, ...rest } = input
  const { created, activeCount } = await listingRepo.createDraftWithQuota(
    ctx.user.id,
    { negotiable: negotiable ?? true, ...rest },
    ACTIVE_LIMIT,
  )
  if (!created) throw AppError.listingLimitReached(activeCount, ACTIVE_LIMIT)
  return buildDetail(created, {
    isOwner: true,
    isAdmin: false,
    isFavorited: false,
    viewerPresent: true,
    activeListingCount: activeCount + 1,
  })
}

/** API-10 / T-02+T-05: submit for moderation — declaration + full BR-022/023/025/026 guards. */
export async function submitListing(ctx: AuthContext, id: string, declarationAccepted: boolean | undefined) {
  // BR-027: the declaration must be affirmatively true (missing/false → specific code).
  if (declarationAccepted !== true) throw AppError.declarationRequired()

  const row = await listingRepo.findOwned(id)
  if (!row) throw AppError.listingNotFound()
  assertOwner(row, ctx)

  // Idempotent repeat on PENDING → refresh declarationAt, no-op (doc 08 §1.7).
  if (row.status === 'PENDING') {
    const refreshed = await listingRepo.patchListing(id, { declarationAt: new Date() })
    return ownerDetail(refreshed!)
  }
  if (!['DRAFT', 'REJECTED'].includes(row.status)) {
    throw AppError.invalidStateTransition(row.status, 'submit') // APPROVED/EXPIRED/SOLD/ARCHIVED
  }

  // Submit guards — collect ALL failures into one details.fields map (wizard jump-to-step).
  const fields = listingFieldIssues(
    {
      species: row.species,
      breedId: row.breedId,
      sex: row.sex,
      ageMonths: row.ageMonths,
      milkYieldLpd: row.milkYieldLpd == null ? null : Number(row.milkYieldLpd),
      lactationNumber: row.lactationNumber,
      isPregnant: row.isPregnant,
      priceInr: row.priceInr,
      districtId: row.districtId,
      village: row.village,
      description: row.description,
    },
    'submit',
  )
  if (row.description && containsPhoneNumber(row.description)) fields.description = 'phone number not allowed'
  const imageCount = await listingRepo.countImages(id)
  if (imageCount < 1) fields.photos = 'at least 1 photo required (BR-023)'
  if (Object.keys(fields).length > 0) throw AppError.validation(fields)

  // BR-029 duplicate heuristic (advisory only — never blocks).
  const duplicateOfId = await listingRepo.findDuplicate(row.sellerId, row.species, row.priceInr!, id)

  const submitted = await listingRepo.submitTransition(id, duplicateOfId)
  if (!submitted) throw AppError.invalidStateTransition(row.status, 'submit') // lost a concurrent race
  // TODO(notifications slice): enqueue NTF-ADMIN-PENDING (BR-071) here.
  return ownerDetail(submitted)
}

function ownerDetail(row: DetailRow) {
  return buildDetail(row, {
    isOwner: true,
    isAdmin: false,
    isFavorited: false,
    viewerPresent: true,
    activeListingCount: 0, // not surfaced on write responses; My Listings carries the meter
  })
}

/** API-14: My Listings — own listings by status, keyset paginated, + quota meta. */
export async function getOwnListings(
  ctx: AuthContext,
  status: string | undefined,
  cursor: string | undefined,
  limit: number,
) {
  let after: [CursorKey, string] | null = null
  if (cursor) {
    after = decodeCursor(cursor)
    if (!after) throw AppError.validation({ cursor: 'malformed cursor' }, { malformed: true })
  }
  const { rows, activeCount } = await listingRepo.ownListings(ctx.user.id, status, after, limit)
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const last = pageRows[pageRows.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt.toISOString(), last.id) : null

  return { items: pageRows.map(toOwnItem), nextCursor, meta: { activeCount, activeLimit: ACTIVE_LIMIT } }
}

// OwnListingItem (doc 08): ListingCard fields + lifecycle fields. Null-tolerant —
// DRAFTs have most attributes unset and no cover image.
function toOwnItem(r: OwnListingRow) {
  return {
    id: r.id,
    species: r.species,
    breed: r.breed,
    sex: r.sex,
    ageMonths: r.ageMonths,
    priceInr: r.priceInr,
    negotiable: r.negotiable,
    isPregnant: r.isPregnant,
    milkYieldLpd: r.milkYieldLpd == null ? null : Number(r.milkYieldLpd),
    district: r.district,
    taluka: r.taluka,
    village: r.village,
    thumbnailUrl: r.images[0]?.url ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    status: r.status,
    rejectionReason: r.rejectionReason,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    soldAt: r.soldAt?.toISOString() ?? null,
    viewCount: r.viewCount,
    interestCount: r._count.interestEvents,
    imageCount: r._count.images,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}
