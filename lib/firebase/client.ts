// Firebase client SDK initialization (browser) — docs/05-features/auth.md:
// the client SDK owns the ENTIRE OTP round-trip (locked decision D3, BR-090 #1);
// the backend never sends an OTP. Config comes from NEXT_PUBLIC_ env vars
// (public by design — security comes from Firebase project rules, not secrecy).

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

function getClientApp(): FirebaseApp {
  const existing = getApps()[0]
  if (existing) return existing

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  if (!config.apiKey || !config.projectId) {
    throw new Error('Firebase client config missing — set NEXT_PUBLIC_FIREBASE_* (docs/13 §2.5)')
  }
  return initializeApp(config)
}

export function getFirebaseAuth(): Auth {
  return getAuth(getClientApp())
}
