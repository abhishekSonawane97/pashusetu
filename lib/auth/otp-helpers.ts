// Pure helpers for the S-02/S-03 login flow — extracted from the page so the
// spec's numeric rules (docs/05-features/auth.md §4–5) are unit-testable.

/** Strip non-digits (paste tolerance) and drop a leading 91/0 country prefix. */
export function normalizePhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 10)
}

/** Valid Indian mobile: exactly 10 digits, first digit 6–9 (auth.md Fields table). */
export function isValidPhone(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits)
}

export function toE164(digits: string): string {
  return `+91${digits}`
}

export const OTP_TIMER_SECONDS = 60 // resend unlocks at timer expiry
export const RESEND_COOLDOWN_SECONDS = 30 // minimum cooldown since the LAST send
export const MAX_WRONG_ATTEMPTS = 3 // 3rd wrong attempt invalidates the code

/**
 * Resend rule (auth.md §4): unlocks when the 60 s timer expires OR immediately
 * after the 3rd wrong attempt — always subject to a minimum 30 s cooldown since
 * the last send. Returns seconds until resend is allowed (0 = allowed now).
 */
export function resendWaitSeconds(secondsSinceLastSend: number, codeInvalidated: boolean): number {
  const cooldownLeft = RESEND_COOLDOWN_SECONDS - secondsSinceLastSend
  const timerLeft = OTP_TIMER_SECONDS - secondsSinceLastSend
  const wait = codeInvalidated ? cooldownLeft : Math.max(timerLeft, cooldownLeft)
  return Math.max(0, Math.ceil(wait))
}
