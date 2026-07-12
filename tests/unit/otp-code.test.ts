// OTP code generation + hashing (lib/otp/code). The security model leans on
// these being correct: fixed 6-digit format (incl. leading zeros), a salted hash
// that never round-trips the code, and constant-time comparison.
import { describe, expect, it } from 'vitest'
import { codeMatches, generateCode, hashCode, newSalt } from '@/lib/otp/code'

describe('OTP code generation', () => {
  it('always produces a 6-digit numeric string (including leading zeros)', () => {
    for (let i = 0; i < 2000; i++) {
      const code = generateCode()
      expect(code).toMatch(/^\d{6}$/)
      expect(code).toHaveLength(6) // catches a String(n)-without-pad bug on small values
    }
  })
})

describe('OTP salt', () => {
  it('is 32 hex chars and distinct across calls', () => {
    const a = newSalt()
    const b = newSalt()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
  })
})

describe('OTP hashing + verification', () => {
  it('matches the same code+salt and rejects wrong code or wrong salt', () => {
    const salt = newSalt()
    const hash = hashCode('123456', salt)
    expect(hash).not.toContain('123456') // plaintext never stored
    expect(codeMatches('123456', salt, hash)).toBe(true)
    expect(codeMatches('654321', salt, hash)).toBe(false)
    expect(codeMatches('123456', newSalt(), hash)).toBe(false) // different salt ⇒ different hash
  })

  it('returns false (not throw) on a malformed stored hash', () => {
    expect(codeMatches('123456', newSalt(), 'not-hex')).toBe(false)
  })
})
