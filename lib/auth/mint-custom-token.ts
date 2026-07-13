// Mint a Firebase custom token WITHOUT the Admin SDK. Loading firebase-admin/auth
// on Vercel's serverless runtime crashes (firebase-admin → jwks-rsa → require() of
// jose@6, ESM-only → ERR_REQUIRE_ESM) — the same failure that broke verifyIdToken,
// and it took down createCustomToken too. A Firebase custom token is just an
// RS256-signed JWT with a fixed audience; we build + sign it with node:crypto and
// the service-account private key (no network, no firebase-admin). The client
// exchanges it via signInWithCustomToken; developer claims placed under `claims`
// are promoted to top-level claims on the resulting ID token (so `phone_number`
// is readable by user-service exactly as before). Verified end-to-end:
// mint → signInWithCustomToken → decoded ID token carries uid + phone_number.

import crypto from 'node:crypto'

const AUD =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit'

const b64url = (b: Buffer) => b.toString('base64url')

export function mintCustomToken(uid: string, claims?: Record<string, unknown>): string {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!clientEmail || !privateKey) {
    throw new Error('FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set')
  }
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload: Record<string, unknown> = {
    iss: clientEmail,
    sub: clientEmail,
    aud: AUD,
    iat: now,
    exp: now + 3600, // Firebase caps custom tokens at 1h; the client trades it for a session
    uid,
  }
  if (claims && Object.keys(claims).length) payload.claims = claims

  const signingInput = `${b64url(Buffer.from(JSON.stringify(header)))}.${b64url(
    Buffer.from(JSON.stringify(payload)),
  )}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey)
  return `${signingInput}.${b64url(signature)}`
}
