// Listing service — search business logic (doc 08 §4). Validates the
// breed/species relationship and district existence against the DB (F-04 AC-3),
// maps rows to the ListingCard wire shape, and builds the keyset cursor.

import { AppError } from '@/lib/errors/app-error'
import { decodeCursor, encodeCursor, type CursorKey } from '@/lib/api/cursor'
import type { ListingCard, Paginated } from '@/lib/api/types'
import type { SearchQuery } from '@/lib/validation/search'
import type { AuthContext } from '@/lib/auth/auth-context'
import * as listingRepo from '@/lib/repositories/listing-repo'
import type { ListingCardRow } from '@/lib/repositories/listing-repo'
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
      activeListingCount,
    },
    viewer: viewer ? { isOwner, isFavorited } : null,
  }

  // Owner/admin extension: six extra fields, omitted entirely for the public.
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
