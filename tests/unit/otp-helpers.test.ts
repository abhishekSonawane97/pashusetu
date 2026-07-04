// auth.md §4–5 numeric rules: 10-digit 6-9 validation with paste tolerance,
// 60 s timer, 30 s minimum cooldown, lockout-triggered early resend.
import { describe, expect, it } from 'vitest'
import {
  isValidPhone,
  normalizePhoneInput,
  resendWaitSeconds,
  toE164,
} from '@/lib/auth/otp-helpers'

describe('phone normalization (S-02)', () => {
  it('strips non-digits and country prefixes from pasted input', () => {
    expect(normalizePhoneInput('+91 98765 43210')).toBe('9876543210')
    expect(normalizePhoneInput('098765 43210')).toBe('9876543210')
    expect(normalizePhoneInput('98765-43210')).toBe('9876543210')
  })

  it('validates exactly 10 digits starting 6-9', () => {
    expect(isValidPhone('9876543210')).toBe(true)
    expect(isValidPhone('6876543210')).toBe(true)
    expect(isValidPhone('5876543210')).toBe(false)
    expect(isValidPhone('987654321')).toBe(false)
  })

  it('formats E.164 for the Firebase call', () => {
    expect(toE164('9876543210')).toBe('+919876543210')
  })
})

describe('resend rule (auth.md §4)', () => {
  it('locked for the full 60 s timer while the code is still valid', () => {
    expect(resendWaitSeconds(10, false)).toBe(50)
    expect(resendWaitSeconds(59, false)).toBe(1)
    expect(resendWaitSeconds(60, false)).toBe(0)
  })

  it('after 3rd-wrong-attempt invalidation, only the 30 s minimum cooldown applies', () => {
    expect(resendWaitSeconds(10, true)).toBe(20)
    expect(resendWaitSeconds(30, true)).toBe(0)
    expect(resendWaitSeconds(45, true)).toBe(0)
  })

  it('never negative', () => {
    expect(resendWaitSeconds(999, false)).toBe(0)
  })
})
