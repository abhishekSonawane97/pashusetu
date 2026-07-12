// Firebase client SDK initialization (browser) — docs/05-features/auth.md.
// OTP is now self-hosted (backend send/verify → custom token); the client SDK is
// used only to exchange that custom token via signInWithCustomToken and to attach
// the resulting ID token to API calls. Config comes from NEXT_PUBLIC_ env vars
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
  // No reCAPTCHA/appVerificationDisabledForTesting here anymore: phone-number auth
  // (signInWithPhoneNumber/RecaptchaVerifier) is gone. Dev/CI OTP test mode is a
  // server concern now (OTP_TEST_MODE — see lib/otp/config.ts).
  return getAuth(getClientApp())
}
