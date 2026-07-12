// OTP service — the login round-trip that replaces Firebase Phone Auth. send()
// generates a code, throttles by phone + IP, and dispatches it via the SMS
// provider; verify() checks it and mints a Firebase custom token so every
// existing token-verification path (verify-auth, firebaseUid keying, ban gate)
// is untouched. All caps are enforced with ATOMIC conditional DB updates (see
// otp-repo) so they hold under concurrent requests. Error codes stay within the
// closed registry (doc 08 §1.3): throttles → RATE_LIMITED (429, with retry-after);
// wrong/expired code → VALIDATION_ERROR (422), details.fields.otp = invalid|expired.

import { AppError } from '@/lib/errors/app-error'
import { toE164 } from '@/lib/auth/otp-helpers'
import { createCustomToken } from '@/lib/auth/firebase-admin'
import * as otpRepo from '@/lib/repositories/otp-repo'
import * as userRepo from '@/lib/repositories/user-repo'
import { codeMatches, generateCode, hashCode, newSalt } from '@/lib/otp/code'
import { sendOtpSms } from '@/lib/otp/sms-provider'
import {
  CODE_TTL_MS,
  MAX_SENDS_PER_IP,
  MAX_SENDS_PER_PHONE,
  MAX_VERIFY_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  SEND_WINDOW_MS,
  isTestMode,
  testCode,
} from '@/lib/otp/config'

const secondsUntil = (atMs: number): number => Math.max(1, Math.ceil((atMs - Date.now()) / 1000))

/** Send (or resend) an OTP to a phone. Never reveals whether the phone is registered. */
export async function sendOtp(phoneNational: string, ip: string): Promise<void> {
  const e164 = toE164(phoneNational)
  const now = new Date()

  // Cheap pre-check: reject an obvious double-tap (within cooldown) BEFORE touching
  // the shared IP budget, so impatient resends don't burn a CGNAT IP's quota. The
  // atomic phone claim below re-enforces the cooldown authoritatively.
  const existing = await otpRepo.getChallenge(e164)
  if (existing && now.getTime() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw AppError.rateLimited(secondsUntil(existing.lastSentAt.getTime() + RESEND_COOLDOWN_MS))
  }

  // Per-IP breadth cap (hard, atomic) — bounds phone enumeration / toll-fraud.
  const ipOk = await otpRepo.claimIpSend(ip, {
    now,
    windowMs: SEND_WINDOW_MS,
    maxSends: MAX_SENDS_PER_IP,
  })
  if (!ipOk) {
    const row = await otpRepo.getIpThrottle(ip)
    throw AppError.rateLimited(row ? secondsUntil(row.windowStart.getTime() + SEND_WINDOW_MS) : 60)
  }

  const code = isTestMode() ? testCode() : generateCode()
  const salt = newSalt()
  const write = {
    codeHash: hashCode(code, salt),
    salt,
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    now,
  }

  // Per-phone cooldown + hourly cap; the new code is written atomically on success.
  const outcome = await otpRepo.claimPhoneSendAndWrite(e164, {
    ...write,
    cooldownMs: RESEND_COOLDOWN_MS,
    windowMs: SEND_WINDOW_MS,
    maxSends: MAX_SENDS_PER_PHONE,
  })
  if (outcome === 'reset-needed') {
    await otpRepo.resetPhoneSend(e164, write)
  } else if (outcome === 'cooldown') {
    const row = await otpRepo.getChallenge(e164)
    throw AppError.rateLimited(
      row
        ? secondsUntil(row.lastSentAt.getTime() + RESEND_COOLDOWN_MS)
        : Math.ceil(RESEND_COOLDOWN_MS / 1000),
    )
  } else if (outcome === 'capped') {
    const row = await otpRepo.getChallenge(e164)
    throw AppError.rateLimited(
      row
        ? secondsUntil(row.windowStart.getTime() + SEND_WINDOW_MS)
        : Math.ceil(SEND_WINDOW_MS / 1000),
    )
  }
  // outcome 'sent' or 'reset-needed' → code is persisted; dispatch it.

  // Test mode (dev/CI only) never sends a real SMS — the fixed code is used.
  if (!isTestMode()) {
    await sendOtpSms(e164, code)
  }
}

/** Verify a code and, on success, return a Firebase custom token for sign-in. */
export async function verifyOtp(
  phoneNational: string,
  code: string,
): Promise<{ customToken: string }> {
  const e164 = toE164(phoneNational)
  const challenge = await otpRepo.getChallenge(e164)

  if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
    throw AppError.validation({ otp: 'expired' }) // no/dead challenge → client resends
  }

  // Consume one attempt ATOMICALLY before testing the code — this is the hard
  // brute-force cap: at most MAX_VERIFY_ATTEMPTS guesses can ever run for a
  // challenge, even under a concurrent flood of guesses (the review's TOCTOU).
  const allowed = await otpRepo.reserveVerifyAttempt(e164, MAX_VERIFY_ATTEMPTS)
  if (!allowed) {
    throw AppError.rateLimited(Math.ceil(RESEND_COOLDOWN_MS / 1000)) // exhausted → force a fresh code
  }

  // codeMatches uses the salt/hash read above — immutable for the challenge's life.
  if (!codeMatches(code, challenge.salt, challenge.codeHash)) {
    throw AppError.validation({ otp: 'invalid' }) // wrong code, try again
  }

  // Correct — single-use: drop the challenge so the code can't be replayed.
  await otpRepo.clearChallenge(e164)

  // Reuse a returning user's existing firebaseUid so they map to their row;
  // otherwise a stable phone-derived uid that their profile row will then store.
  const existingUser = await userRepo.findByPhone(e164)
  const uid = existingUser?.firebaseUid ?? `phone_${phoneNational}`

  // phone_number claim → user-service reads it from the verified token exactly as
  // it did under Firebase Phone Auth, so profile creation needs no change.
  const customToken = await createCustomToken(uid, { phone_number: e164 })
  return { customToken }
}
