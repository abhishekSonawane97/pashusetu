// OTP code generation + verification. The code is never stored or logged in
// plaintext: we keep a per-challenge random salt and sha256(salt:code), and
// compare in constant time. crypto.randomInt gives a uniform code (no modulo bias).

import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { CODE_LENGTH } from './config'

export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0')
}

export function newSalt(): string {
  return randomBytes(16).toString('hex')
}

export function hashCode(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex')
}

export function codeMatches(code: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashCode(code, salt), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
