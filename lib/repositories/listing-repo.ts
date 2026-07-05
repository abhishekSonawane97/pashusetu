// Listing repository — Prisma queries only (doc 09 §2). Search is keyset-
// paginated (doc 08 §4.2): fetch limit+1 to know if there's a next page.

import type { Prisma } from '@prisma/client'
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
