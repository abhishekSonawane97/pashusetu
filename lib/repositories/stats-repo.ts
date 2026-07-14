// Analytics aggregates (admin dashboard, NFR-10). Read-only Prisma aggregates over
// data the marketplace already collects: listing statuses/ages, per-listing viewCount
// (BR-034), and interest_events (Call/WhatsApp/Interest, BR-062). No new tables.

import { prisma } from '@/lib/prisma'

export function listingCountsByStatus() {
  return prisma.listing.groupBy({ by: ['status'], _count: { _all: true } })
}

export function newListingCount(since: Date) {
  return prisma.listing.count({ where: { createdAt: { gte: since } } })
}

export async function approvedViewStats() {
  const agg = await prisma.listing.aggregate({
    where: { status: 'APPROVED' },
    _sum: { viewCount: true },
  })
  const top = await prisma.listing.findMany({
    where: { status: 'APPROVED' },
    orderBy: [{ viewCount: 'desc' }, { id: 'desc' }],
    take: 5,
    select: {
      id: true,
      viewCount: true,
      species: true,
      breed: { select: { nameMr: true } },
      district: { select: { nameMr: true } },
    },
  })
  return { totalViews: agg._sum.viewCount ?? 0, top }
}

export function interestCountsByType(since?: Date) {
  return prisma.interestEvent.groupBy({
    by: ['type'],
    _count: { _all: true },
    ...(since ? { where: { createdAt: { gte: since } } } : {}),
  })
}

/** APPROVED listings that have never received a Call/WhatsApp/Interest tap. */
export function zeroEnquiryApprovedCount() {
  return prisma.listing.count({
    where: { status: 'APPROVED', interestEvents: { none: {} } },
  })
}

/** Top districts by APPROVED listing count — where supply is concentrated. */
export async function topDistrictsByApproved() {
  const rows = await prisma.listing.groupBy({
    by: ['districtId'],
    where: { status: 'APPROVED', districtId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { districtId: 'desc' } },
    take: 5,
  })
  const districts = await prisma.district.findMany({
    where: { id: { in: rows.map((r) => r.districtId!).filter(Boolean) } },
    select: { id: true, nameMr: true },
  })
  const nameById = new Map(districts.map((d) => [d.id, d.nameMr]))
  return rows.map((r) => ({ nameMr: nameById.get(r.districtId!) ?? '—', count: r._count._all }))
}
