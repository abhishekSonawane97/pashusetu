// /llms.txt — a plain-text summary for LLM crawlers (go-live checklist §8; no
// formal spec exists, so this follows the emerging llms.txt convention). Domain
// comes from SITE_URL so it's correct in every environment. Public info only —
// no seller phones (BR-066).
import { SITE_URL } from '@/lib/seo/site'

export const revalidate = 86400

export function GET() {
  const body = `# PashuSetu (पशुसेतू)

> A Marathi-first, mobile-first livestock marketplace for rural Maharashtra, India.
> Farmers list cattle (cows, buffaloes, bullocks), goats, and sheep for sale;
> buyers browse without login and contact sellers by call or WhatsApp. Every
> listing is human-moderated before it appears publicly. Listing prices are in INR.

## Key pages
- Home: ${SITE_URL}/
- Browse / search animals: ${SITE_URL}/listings
- Listing detail: ${SITE_URL}/listings/{id}

## Notes
- Content language: Marathi (mr-IN).
- Only APPROVED listings are public; unavailable listings return HTTP 404.
- Seller phone numbers are never exposed in pages, metadata, or the sitemap.
- Sitemap: ${SITE_URL}/sitemap.xml
`
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
