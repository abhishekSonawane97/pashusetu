// Sitemap data — NFR-09: sitemap contains ONLY APPROVED listings (non-APPROVED
// URLs 404 and fall out of indexes, F-05 AC-7). Ids + updatedAt for lastmod.

import { prisma } from '@/lib/prisma'

export function approvedListingSitemapEntries(): Promise<{ id: string; updatedAt: Date }[]> {
  return prisma.listing.findMany({
    where: { status: 'APPROVED' },
    select: { id: true, updatedAt: true },
    orderBy: { approvedAt: 'desc' },
    take: 45000, // sitemap URL cap headroom (single-file limit is 50k)
  })
}
