// Verify a Firebase ID token WITHOUT the Admin SDK's verifyIdToken(). On Vercel's
// serverless runtime that call crashes: firebase-admin → jwks-rsa → require() of
// jose@6 (ESM-only) → ERR_REQUIRE_ESM, so every authenticated request 401s. We do
// Firebase's documented "verify without the Admin SDK" instead, with Node's
// built-in crypto: fetch Google's securetoken public certs, check the RS256
// signature, and validate iss/aud/exp/sub. (Custom-token MINTING still uses the
// Admin SDK — that path signs locally and works fine.)

import crypto from 'node:crypto'
import type { DecodedIdToken } from 'firebase-admin/auth'

// Public x509 certs for Firebase ID tokens (signed by securetoken@system).
const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

// Module-scoped cache so we don't fetch Google's certs on every request; honored
// per the endpoint's Cache-Control max-age. Google rotates keys ~daily.
let cache: { certs: Record<string, string>; expiresAt: number } = { certs: {}, expiresAt: 0 }

async function fetchCerts(): Promise<Record<string, string>> {
  const res = await fetch(CERTS_URL)
  if (!res.ok) throw new Error(`securetoken certs fetch failed: ${res.status}`)
  const certs = (await res.json()) as Record<string, string>
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600)
  cache = { certs, expiresAt: Date.now() + maxAge * 1000 }
  return certs
}

async function certForKid(kid: string): Promise<string> {
  const fresh = Date.now() < cache.expiresAt
  const certs = fresh && Object.keys(cache.certs).length ? cache.certs : await fetchCerts()
  if (certs[kid]) return certs[kid]
  // kid not found (key rotation) — force one refetch before giving up.
  const refreshed = await fetchCerts()
  if (refreshed[kid]) return refreshed[kid]
  throw new Error('no matching securetoken key for token kid')
}

const b64json = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'))

export async function verifyFirebaseIdToken(token: string): Promise<DecodedIdToken> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID not set')

  const [h, p, s] = token.split('.')
  if (!h || !p || !s) throw new Error('malformed token')

  const header = b64json(h)
  if (header.alg !== 'RS256' || !header.kid) throw new Error('unexpected token header')

  const pem = await certForKid(header.kid)
  const signed = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${h}.${p}`),
    crypto.createPublicKey(pem),
    Buffer.from(s, 'base64url'),
  )
  if (!signed) throw new Error('bad signature')

  const payload = b64json(p)
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new Error('token expired')
  if (typeof payload.iat !== 'number' || payload.iat > now + 300) throw new Error('bad iat')
  if (payload.aud !== projectId) throw new Error('bad aud')
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad iss')
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('missing sub')

  // Admin SDK exposes the subject as `uid`; mirror that so callers are unchanged.
  return { ...payload, uid: payload.sub } as DecodedIdToken
}
