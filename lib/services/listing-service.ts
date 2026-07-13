// Listing service — search business logic (doc 08 §4). Validates the
// breed/species relationship and district existence against the DB (F-04 AC-3),
// maps rows to the ListingCard wire shape, and builds the keyset cursor.

import { AppError } from '@/lib/errors/app-error'
import { decodeCursor, encodeCursor, type CursorKey } from '@/lib/api/cursor'
import type { ListingCard, Paginated, RelatedSection } from '@/lib/api/types'
import type { SearchQuery } from '@/lib/validation/search'
import type { Species } from '@/lib/validation/common'
import type { AuthContext } from '@/lib/auth/auth-context'
import { assertOwnerVisible } from '@/lib/auth/verify-auth'
import * as listingRepo from '@/lib/repositories/listing-repo'
import type { ListingCardRow, OwnListingRow } from '@/lib/repositories/listing-repo'
import { containsPhoneNumber } from '@/lib/validation/common'
import {
  listingFieldIssues,
  type CreateListingInput,
  type UpdateListingInput,
} from '@/lib/validation/listings'
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
    thumbnailUrl: cardThumb(row.images[0]?.url),
    approvedAt: row.approvedAt!.toISOString(),
  }
}

function cursorKeyFor(sort: SearchQuery['sort'], row: ListingCardRow): CursorKey {
  if (sort === 'price_asc' || sort === 'price_desc') return row.priceInr!
  return row.createdAt.toISOString()
}

// ListingImage.url stores the variant BASE (doc 09 §7); the three named URLs
// (doc 08 ListingDetail shape) append the variant filename. Cards use the
// card-sized variant to stay within the 3G weight budget (NFR-01).
function imageUrls(base: string) {
  return { thumb: `${base}/thumb.webp`, card: `${base}/card.webp`, detail: `${base}/detail.webp` }
}
function cardThumb(base: string | undefined): string | null {
  return base ? `${base}/card.webp` : null
}

type DetailRow = import('@/lib/repositories/listing-repo').ListingDetailRow

// Shared ListingDetail serializer (doc 08 §1.9) — used by the public read path
// and by every owner write op. Owner/admin get the 6 extension fields; the
// public never sees them. Seller is first-name-only, never a phone (BR-066).
function buildDetail(
  row: DetailRow,
  opts: {
    isOwner: boolean
    isAdmin: boolean
    isFavorited: boolean
    viewerPresent: boolean
    activeListingCount: number
  },
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

  return buildDetail(row, {
    isOwner,
    isAdmin,
    isFavorited,
    viewerPresent: !!viewer,
    activeListingCount,
  })
}

/**
 * Related-animals shelves for the detail page (S-07). Server-side, reusing
 * searchApproved (APPROVED-only, indexed) — no extra API. Each shelf excludes the
 * current listing (excludeId) and dedupes across shelves so an animal appears
 * once. Empty shelves are omitted. Currently one shelf — same district + species
 * ("nearby"); breed / seller / price shelves slot in the same way when wanted
 * (searchApproved already supports breedId / sellerId / minPrice+maxPrice).
 */
export async function getRelated(
  detail: Record<string, unknown>,
  limit = 12,
): Promise<RelatedSection[]> {
  const id = detail.id as string
  const species = detail.species as Species | undefined
  const district = detail.district as { id: string; nameMr: string } | null

  const sections: RelatedSection[] = []
  const seen = new Set<string>([id]) // never surface the current listing in its own shelves

  const pushShelf = async (
    key: string,
    title: string,
    seeAllHref: string | undefined,
    query: SearchQuery,
  ) => {
    const rows = await listingRepo.searchApproved(query, null, id)
    const items = rows
      .filter((r) => !seen.has(r.id))
      .slice(0, limit)
      .map(toCard)
    if (!items.length) return
    items.forEach((it) => seen.add(it.id))
    sections.push({ key, title, seeAllHref, items })
  }

  // Nearby — other APPROVED animals of the same species in this listing's district.
  if (species && district?.id) {
    await pushShelf(
      'nearby',
      `${district.nameMr} मधील जनावरे`,
      `/listings?districtId=${encodeURIComponent(district.id)}&species=${species}`,
      { species, districtId: district.id, sort: 'newest', limit: limit + 1 },
    )
  }

  return sections
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

/**
 * API-09: partial edit (server computes the changed set — client intent is never
 * trusted). Status behavior per BR-028/T-09:
 *   DRAFT/REJECTED/PENDING → apply, keep status (PENDING bumps FIFO position)
 *   APPROVED, changed ⊆ {priceInr, negotiable} → apply, stay APPROVED (expires_at untouched)
 *   APPROVED, any other change → T-09: → PENDING (requires declarationAccepted true)
 *   EXPIRED/SOLD/ARCHIVED → EDIT_NOT_ALLOWED (immutable, BR-028)
 */
export async function editListing(ctx: AuthContext, id: string, input: UpdateListingInput) {
  const row = await listingRepo.findOwned(id)
  if (!row) throw AppError.listingNotFound()
  assertOwnerVisible(ctx, row) // hidden listing → 404 for non-owners (no existence oracle)
  if (['EXPIRED', 'SOLD', 'ARCHIVED'].includes(row.status))
    throw AppError.editNotAllowed(row.status)

  const { imageOrder, declarationAccepted, ...scalars } = input

  // Cross-field BR-022 validity on the MERGED row (species change resets breed compat).
  const merged = {
    species: scalars.species ?? row.species,
    breedId: scalars.breedId ?? row.breedId,
    sex: scalars.sex ?? row.sex,
    milkYieldLpd:
      scalars.milkYieldLpd !== undefined
        ? scalars.milkYieldLpd
        : row.milkYieldLpd == null
          ? null
          : Number(row.milkYieldLpd),
    lactationNumber:
      scalars.lactationNumber !== undefined ? scalars.lactationNumber : row.lactationNumber,
    isPregnant: scalars.isPregnant !== undefined ? scalars.isPregnant : row.isPregnant,
  }
  const issues = listingFieldIssues(merged, 'draft')
  // Species change must leave a breed that belongs to the new species (BR-022).
  if (scalars.species && merged.breedId) {
    const breed = await prisma.breed.findUnique({ where: { id: merged.breedId } })
    if (!breed || breed.species !== merged.species)
      issues.breedId = 'breed does not belong to species'
  }
  if (Object.keys(issues).length > 0) throw AppError.validation(issues)

  // Which columns actually changed (server-computed, not client-declared).
  const changedKeys = Object.keys(scalars) as (keyof typeof scalars)[]
  const contentChange =
    imageOrder !== undefined || changedKeys.some((k) => k !== 'priceInr' && k !== 'negotiable')

  const data: Record<string, unknown> = { ...scalars }

  if (row.status === 'APPROVED' && contentChange) {
    // T-09: re-moderation. Requires the declaration to be re-affirmed (BR-027).
    if (declarationAccepted !== true) throw AppError.declarationRequired()
    data.status = 'PENDING'
    data.declarationAccepted = true
    data.declarationAt = new Date()
    // TODO(notifications slice): NTF-ADMIN-PENDING on T-09.
  }
  // else: APPROVED price-only → stays APPROVED (expires_at untouched); DRAFT/
  // REJECTED/PENDING → apply and keep status.

  if (imageOrder) {
    const ok = await listingRepo.reorderImages(id, imageOrder)
    if (!ok) {
      throw AppError.validation(
        { imageOrder: 'must be a permutation of this listing’s current image ids' },
        { malformed: true },
      )
    }
  }
  const updated = await listingRepo.patchListing(id, data)
  return ownerDetail(updated!)
}

/** API-10 / T-02+T-05: submit for moderation — declaration + full BR-022/023/025/026 guards. */
export async function submitListing(
  ctx: AuthContext,
  id: string,
  declarationAccepted: boolean | undefined,
) {
  // BR-027: the declaration must be affirmatively true (missing/false → specific code).
  if (declarationAccepted !== true) throw AppError.declarationRequired()

  const row = await listingRepo.findOwned(id)
  if (!row) throw AppError.listingNotFound()
  assertOwnerVisible(ctx, row) // hidden listing → 404 for non-owners (no existence oracle)

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
      taluka: row.taluka,
      village: row.village,
      description: row.description,
    },
    'submit',
  )
  if (row.description && containsPhoneNumber(row.description))
    fields.description = 'phone number not allowed'
  const imageCount = await listingRepo.countImages(id)
  if (imageCount < 3) fields.photos = 'at least 3 photos required (BR-023)'
  if (Object.keys(fields).length > 0) throw AppError.validation(fields)

  // BR-029 duplicate heuristic (advisory only — never blocks).
  const duplicateOfId = await listingRepo.findDuplicate(
    row.sellerId,
    row.species,
    row.priceInr!,
    id,
  )

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

  return {
    items: pageRows.map(toOwnItem),
    nextCursor,
    meta: { activeCount, activeLimit: ACTIVE_LIMIT },
  }
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
    thumbnailUrl: cardThumb(r.images[0]?.url),
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
