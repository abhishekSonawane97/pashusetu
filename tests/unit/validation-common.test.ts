// BR-065 (phone-in-text hard block), BR-025/BR-026 bounds, BR-090 #12 pagination.
import { describe, expect, it } from 'vitest'
import {
  containsPhoneNumber,
  cuidSchema,
  description,
  paginationSchema,
  priceInr,
  speciesSchema,
} from '@/lib/validation/common'

describe('containsPhoneNumber (BR-065)', () => {
  it.each([
    '9876543210',
    'call +91 98765 43210 now',
    'फोन ९८७६५४३२१०',
    'नंबर 98765-43210 वर बोला',
    '12345678901',
    '9 8 7 6 5 4 3 2 1 0',
  ])('rejects %s', (text) => {
    expect(containsPhoneNumber(text)).toBe(true)
  })

  it.each([
    'चांगली गाय आहे, दररोज 12 लिटर दूध देते',
    'वय 4 वर्षे, 2 वेत झाले',
    'healthy Gir cow, 3rd lactation, price negotiable',
    'गाभण म्हैस, 9 महिने',
  ])('accepts normal text: %s', (text) => {
    expect(containsPhoneNumber(text)).toBe(false)
  })
})

describe('description (BR-025)', () => {
  it('accepts a valid Marathi description', () => {
    expect(description.safeParse('चांगली गाय आहे, दररोज 12 लिटर दूध देते.').success).toBe(true)
  })
  it('rejects too-short, too-long, and phone-bearing text', () => {
    expect(description.safeParse('लहान').success).toBe(false)
    expect(description.safeParse('अ'.repeat(1001)).success).toBe(false)
    expect(description.safeParse('चांगली गाय. फोन 9876543210 वर संपर्क करा.').success).toBe(false)
  })
})

describe('priceInr (BR-026)', () => {
  it('enforces ₹500–₹10,00,000 integer bounds', () => {
    expect(priceInr.safeParse(499).success).toBe(false)
    expect(priceInr.safeParse(500).success).toBe(true)
    expect(priceInr.safeParse(1_000_000).success).toBe(true)
    expect(priceInr.safeParse(1_000_001).success).toBe(false)
    expect(priceInr.safeParse(500.5).success).toBe(false)
  })
})

describe('paginationSchema (BR-090 #12)', () => {
  it('defaults limit to 20', () => {
    expect(paginationSchema.parse({})).toEqual({ limit: 20 })
  })
  it('accepts limit 50, rejects 51 and 0', () => {
    expect(paginationSchema.safeParse({ limit: '50' }).success).toBe(true)
    expect(paginationSchema.safeParse({ limit: '51' }).success).toBe(false)
    expect(paginationSchema.safeParse({ limit: '0' }).success).toBe(false)
  })
})

describe('id and enum schemas', () => {
  it('cuidSchema matches cuids only', () => {
    expect(cuidSchema.safeParse('clxyz0123456789abcdefgh').success).toBe(true)
    expect(cuidSchema.safeParse('42').success).toBe(false)
    expect(cuidSchema.safeParse('DROP TABLE listings').success).toBe(false)
  })
  it('species enum is the exact doc 07 value set', () => {
    expect(speciesSchema.options).toEqual(['COW', 'BUFFALO', 'BULL_OX', 'GOAT', 'SHEEP'])
  })
})
