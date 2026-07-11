import type { NextConfig } from 'next'

// Storage origins the browser talks to directly: the presigned-upload PUT goes to
// the S3 API endpoint (R2_ENDPOINT; dev = local MinIO), and listing photos are read
// from the public base (R2_PUBLIC_BASE_URL; prod = img.pashusetu.in CDN). Both must
// be whitelisted in CSP or the upload PUT / image loads are refused by the browser.
// Derived from env so dev (localhost:9000) and prod (R2) work from one config.
const storageOrigins = Array.from(
  new Set(
    [process.env.R2_ENDPOINT, process.env.R2_PUBLIC_BASE_URL]
      .map((u) => {
        try {
          return u ? new URL(u).origin : null
        } catch {
          return null
        }
      })
      .filter((o): o is string => !!o),
  ),
)
const storageSrc = storageOrigins.length ? ' ' + storageOrigins.join(' ') : ''

// The public image host, derived from R2_PUBLIC_BASE_URL, so the Next image
// optimizer's allow-list follows wherever the images actually live (dev MinIO →
// Supabase → R2 later) with ZERO code edits — just the env value. This is a single
// EXPLICIT host (never a wildcard): it sits ALONGSIDE the hardcoded pashusetu +
// localhost entries below. remotePatterns is not an access control on the images
// (the public bucket is world-readable); it stops /_next/image from being abused
// as an open proxy / SSRF vector (doc 12 §8), so we keep it tight.
const publicImagePattern = (() => {
  try {
    if (!process.env.R2_PUBLIC_BASE_URL) return null
    const u = new URL(process.env.R2_PUBLIC_BASE_URL)
    const protocol = u.protocol === 'https:' ? ('https' as const) : ('http' as const)
    return { protocol, hostname: u.hostname, ...(u.port ? { port: u.port } : {}) }
  } catch {
    return null
  }
})()

// DEV ONLY: React's development build uses eval() to reconstruct call stacks for
// debugging (and Turbopack HMR evaluates modules the same way), so `next dev`
// needs 'unsafe-eval' in script-src or the browser refuses it and React logs a
// console error. React never uses eval() in production, so this is gated on
// NODE_ENV and is NEVER emitted in the built/deployed CSP — the prod policy stays
// eval-free (doc 12 §8: 'unsafe-eval' is an XSS vector we don't ship).
const devScriptSrc = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''

// Security headers — docs/12-security/README.md §8.1 (PS-007). Single source;
// verified live by the ST-09 header check on every production deploy (doc 13 §3.3).
// CSP note: 'unsafe-inline' in script-src is required by the Next.js bootstrap +
// Firebase reCAPTCHA loader in MVP; primary XSS control is React escaping +
// validation (§8.2–8.3). Nonce-based strict CSP is a post-launch hardening task.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://maps.googleapis.com" +
    devScriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.pashusetu.in" + storageSrc,
  "font-src 'self'",
  // www.google.com + recaptcha.net + gstatic are the reCAPTCHA fetch endpoints
  // Firebase phone auth uses (verified against a real OTP flow, 2026-07-05) —
  // frame-src alone is not enough; the reCAPTCHA client also fetch()es them.
  // storageSrc adds the presigned-upload PUT target (R2 S3 endpoint / dev MinIO).
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://www.googleapis.com https://maps.googleapis.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://*.ingest.sentry.io" +
    storageSrc,
  'frame-src https://www.google.com https://recaptcha.google.com https://www.recaptcha.net',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Camera allowed for listing-photo capture; geolocation never requested (doc 12 §5.4).
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(), microphone=(), payment=()' },
  // Keeps reCAPTCHA/Firebase popup flows working.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
]

const nextConfig: NextConfig = {
  // Pin the workspace root to this project — a stray package-lock.json in the
  // parent dir was making Turbopack infer the wrong root (dev-log warning).
  turbopack: { root: import.meta.dirname },
  // Listing images: prod is optimized off the R2 public CDN (img.pashusetu.in /
  // img-dev.pashusetu.in — allowed below). DEV ONLY: the optimizer hard-blocks
  // loopback/localhost hosts as SSRF protection (a remotePattern can't override
  // it), so MinIO thumbnails would 400 through /_next/image. In dev we therefore
  // skip optimization and let <Image> load the MinIO URL directly (CSP img-src
  // already allows it). Prod keeps full optimization — this never ships.
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      { protocol: 'https', hostname: 'img.pashusetu.in' },
      { protocol: 'https', hostname: 'img-dev.pashusetu.in' },
      // Dev fallback if optimization is ever re-enabled locally (still SSRF-blocked).
      { protocol: 'http', hostname: 'localhost', port: '9000' },
      // The current storage host from env (e.g. <ref>.supabase.co). One explicit
      // host, not a wildcard; deduped against the entries above by Next.
      ...(publicImagePattern ? [publicImagePattern] : []),
    ],
  },
  async headers() {
    return [
      { source: '/(.*)', headers: SECURITY_HEADERS },
      // The service worker must never be served stale, or SW updates (manual
      // VERSION bump in public/sw.js) won't reach clients. Service-Worker-Allowed
      // lets it control the whole origin scope.
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
