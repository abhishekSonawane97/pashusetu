import type { NextConfig } from 'next'

// Security headers — docs/12-security/README.md §8.1 (PS-007). Single source;
// verified live by the ST-09 header check on every production deploy (doc 13 §3.3).
// CSP note: 'unsafe-inline' in script-src is required by the Next.js bootstrap +
// Firebase reCAPTCHA loader in MVP; primary XSS control is React escaping +
// validation (§8.2–8.3). Nonce-based strict CSP is a post-launch hardening task.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://maps.googleapis.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.pashusetu.in",
  "font-src 'self'",
  // www.google.com + recaptcha.net + gstatic are the reCAPTCHA fetch endpoints
  // Firebase phone auth uses (verified against a real OTP flow, 2026-07-05) —
  // frame-src alone is not enough; the reCAPTCHA client also fetch()es them.
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://www.googleapis.com https://maps.googleapis.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://*.ingest.sentry.io",
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
  // Listing images are served from the R2 public CDN domains (doc 13 §1: prod
  // img.pashusetu.in, dev img-dev.pashusetu.in). Only these hosts are allowed.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.pashusetu.in' },
      { protocol: 'https', hostname: 'img-dev.pashusetu.in' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
