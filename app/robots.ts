// robots.txt — NFR-09 / doc 12: allow public pages, disallow /api and /admin.
// Non-production deploys (Vercel preview/staging) are fully disallowed so they
// never get indexed and compete with the real domain.
import type { MetadataRoute } from 'next'
import { SITE_URL as BASE } from '@/lib/seo/site'

export default function robots(): MetadataRoute.Robots {
  const isPreview = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production'
  if (isPreview) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/login', '/profile'] },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
