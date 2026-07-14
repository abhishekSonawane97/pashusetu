// Stats service (admin analytics, NFR-10). Admin identity is verified upstream
// (requireAdmin in the route). Composes the read-only aggregates into one JSON-safe
// snapshot — "what's actually happening after launch" without guessing.

import * as statsRepo from '@/lib/repositories/stats-repo'

export async function getStats() {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [byStatus, newToday, newWeek, views, interestAll, interest7d, zeroEnquiry, topDistricts] =
    await Promise.all([
      statsRepo.listingCountsByStatus(),
      statsRepo.newListingCount(startOfToday),
      statsRepo.newListingCount(weekAgo),
      statsRepo.approvedViewStats(),
      statsRepo.interestCountsByType(),
      statsRepo.interestCountsByType(weekAgo),
      statsRepo.zeroEnquiryApprovedCount(),
      statsRepo.topDistrictsByApproved(),
    ])

  const statusCounts: Record<string, number> = {}
  let totalListings = 0
  for (const r of byStatus) {
    statusCounts[r.status] = r._count._all
    totalListings += r._count._all
  }

  const sumByType = (rows: typeof interestAll) => {
    const m = { CALL: 0, WHATSAPP: 0, INTEREST: 0 }
    for (const r of rows) m[r.type] = r._count._all
    return m
  }
  const iAll = sumByType(interestAll)
  const i7d = sumByType(interest7d)

  return {
    listings: { total: totalListings, byStatus: statusCounts, newToday, newWeek },
    views: {
      total: views.totalViews,
      top: views.top.map((t) => ({
        id: t.id,
        viewCount: t.viewCount,
        species: t.species,
        breedMr: t.breed?.nameMr ?? null,
        districtMr: t.district?.nameMr ?? null,
      })),
    },
    interest: {
      call: iAll.CALL,
      whatsapp: iAll.WHATSAPP,
      interest: iAll.INTEREST,
      total: iAll.CALL + iAll.WHATSAPP + iAll.INTEREST,
      last7dTotal: i7d.CALL + i7d.WHATSAPP + i7d.INTEREST,
    },
    zeroEnquiryApproved: zeroEnquiry,
    topDistricts,
  }
}
