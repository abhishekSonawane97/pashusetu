// Firebase Admin initialization for serverless — docs/09-backend/README.md §3.3.
// Singleton across warm invocations; cold start pays init once. The three env
// vars are asset AS-06 (doc 12) — three separate vars so the multiline private
// key survives Vercel's env UI and rotates independently.
//
// firebase-admin is loaded via DYNAMIC import() (not a top-level static import):
// on Vercel's per-route serverless lambdas a static import gets externalized and
// require()'d, and firebase-admin's ESM entry then throws ERR_REQUIRE_ESM — which
// 500'd every auth-importing route (listings/detail/users/me) in production while
// working locally under `next start`. Dynamic import() uses the ESM loader and
// resolves the package's exports correctly, so it loads in both. getAdminAuth is
// therefore async; its one caller (verify-auth) already awaits in an async path.

import type { App } from 'firebase-admin/app'
import type { Auth } from 'firebase-admin/auth'

async function initAdminApp(): Promise<App> {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app')
  const existing = getApps()[0]
  if (existing) return existing // reuse across warm invocations
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'), // Vercel stores \n escaped
    }),
  })
}

export async function getAdminAuth(): Promise<Auth> {
  const { getAuth } = await import('firebase-admin/auth')
  return getAuth(await initAdminApp())
}

// Mint a Firebase custom token after a successful self-hosted OTP verify. The
// client exchanges it via signInWithCustomToken(); the resulting ID token verifies
// through the SAME verifyIdToken() path as before. `claims` are copied into the ID
// token — we pass { phone_number } so user-service reads the phone from the token
// exactly as it did with Firebase Phone Auth. Custom tokens are FREE (no Blaze,
// no billing account), which is the whole point of moving OTP off Firebase SMS.
export async function createCustomToken(
  uid: string,
  claims?: Record<string, unknown>,
): Promise<string> {
  const auth = await getAdminAuth()
  return auth.createCustomToken(uid, claims)
}
