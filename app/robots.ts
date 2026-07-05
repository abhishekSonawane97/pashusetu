// robots.txt — NFR-09 / doc 12: allow public pages, disallow /api and /admin.
import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pashusetu.in'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/login', '/profile'] },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
