// Single source of truth for the app's public base URL (NFR-09). Everything that
// emits an absolute URL — canonical/OG tags, sitemap, robots, JSON-LD — reads from
// here, so the domain is configured once via NEXT_PUBLIC_APP_URL (prod:
// https://pashusetu.online — registered 2026-07-12). No trailing slash. The env
// var is authoritative in prod/Vercel; this fallback keeps SSR + tests working
// locally and if the env is ever unset.
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pashusetu.online').replace(
  /\/+$/,
  '',
)

/** Absolute URL for a site-relative path (canonical/OG/sitemap). */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

// Default social-share image (1200×630) for pages without their own OG image —
// a branded placeholder; swap public/og-default.png when the real logo lands.
export const DEFAULT_OG = '/og-default.png'

// Canonical + hreflang together (NFR-09). Next replaces the whole `alternates`
// object per segment (no deep-merge), so every page that sets a canonical must
// re-declare `languages` or it loses the hreflang links. mr-IN is the only real
// locale; x-default points at the same URL (en-IN routing is pending — see plan).
export function seoAlternates(path: string) {
  return { canonical: path, languages: { 'mr-IN': path, 'x-default': path } }
}
