// Listing service — search business logic (doc 08 §4). Validates the
// breed/species relationship and district existence against the DB (F-04 AC-3),
// maps rows to the ListingCard wire shape, and builds the keyset cursor.

import { AppError } from '@/lib/errors/app-error'
import { decodeCursor, encodeCursor, type CursorKey } from '@/lib/api/cursor'
import type { ListingCard, Paginated } from '@/lib/api/types'
import type { SearchQuery } from '@/lib/validation/search'
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
