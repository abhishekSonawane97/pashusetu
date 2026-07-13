// Self-hosted phone-OTP tuning (docs/05 auth). These bound both code brute-force
// and SMS toll-fraud cost — the security model is short expiry + a wrong-attempt
// cap + per-phone/per-IP send windows, NOT hash strength (a 6-digit code is
// brute-forceable offline regardless, so the caps are what matter).

export const CODE_LENGTH = 6
// Rural networks can deliver the SMS several minutes late, so give a generous
// window to enter the code. This is safe: the wrong-attempt cap (MAX_VERIFY_ATTEMPTS),
// not a short TTL, is what bounds brute-force — a 6-digit code allows only 5 guesses
// before a fresh code is required, regardless of how long it stays valid.
export const CODE_TTL_MS = 10 * 60 * 1000 // a sent code is valid 10 minutes
export const RESEND_COOLDOWN_MS = 30 * 1000 // min gap between sends to one phone (matches S-03 UI)
export const SEND_WINDOW_MS = 60 * 60 * 1000 // fixed 1h window for the send caps
export const MAX_SENDS_PER_PHONE = 5 // sends per phone per window (the real cost cap)
// Per-IP cap is a coarse breadth bound, NOT per-user: rural Maharashtra mobile
// users share carrier-grade-NAT IPs, so many distinct people egress one IP. Kept
// generous so a shared IP doesn't lock out legitimate logins, while still bounding
// toll-fraud (100 × ~₹0.15 = ~₹15/hr/IP worst case; the per-phone cap is the tight one).
export const MAX_SENDS_PER_IP = 100 // sends per IP per window
export const MAX_VERIFY_ATTEMPTS = 5 // wrong-code tries before a fresh code is required

// Dev/CI ONLY (server env OTP_TEST_MODE=1, never set in prod): skip the real SMS
// send and use a fixed code so Playwright/integration can drive the full flow
// with no SMS cost. Mirrors the old Firebase test-number bypass; prod (env absent)
// always generates a random code and sends it for real.
export function isTestMode(): boolean {
  return process.env.OTP_TEST_MODE === '1'
}

export function testCode(): string {
  return process.env.OTP_TEST_CODE ?? '246810'
}
