// Firebase Admin initialization for serverless — docs/09-backend/README.md §3.3
// (exact pattern). Singleton across warm invocations; cold start pays init once.
// The three env vars are asset AS-06 (doc 12) — three separate vars so the
// multiline private key survives Vercel's env UI and rotates independently.

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function initAdminApp(): App {
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

export const getAdminAuth = () => getAuth(initAdminApp())
