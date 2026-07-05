// sitemap.xml — NFR-09: static public pages + every APPROVED listing detail URL,
// regenerated daily (revalidate). Only APPROVED listings appear (F-05 AC-7).
// Degrades to the static pages if the DB is unreachable at generation time.
import type { MetadataRoute } from 'next'
import { approvedListingSitemapEntries } from '@/lib/repositories/sitemap-repo'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pashusetu.in'

export const revalidate = 86400 // daily

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/listings`, changeFrequency: 'daily', priority: 0.9 },
  ]

  let listings: MetadataRoute.Sitemap = []
  try {
    const rows = await approvedListingSitemapEntries()
    listings = rows.map((l) => ({
      url: `${BASE}/listings/${l.id}`,
      lastModified: l.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    }))
  } catch {
    // DB unreachable at build/regeneration → ship the static pages only.
  }

  return [...staticPages, ...listings]
}
