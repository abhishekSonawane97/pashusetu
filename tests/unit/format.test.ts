import { describe, expect, it } from 'vitest'
import { ageMonthsToMr, formatInr, timeSinceMr } from '@/lib/utils/format'

describe('formatInr (design hard rule 1: Indian grouping, Latin digits)', () => {
  it('groups in the Indian system with a ₹ prefix', () => {
    expect(formatInr(125000)).toBe('₹1,25,000')
    expect(formatInr(65000)).toBe('₹65,000')
    expect(formatInr(1000000)).toBe('₹10,00,000')
    expect(formatInr(500)).toBe('₹500')
  })
})

describe('timeSinceMr', () => {
  const now = new Date('2026-07-05T12:00:00.000Z').getTime()
  const ago = (ms: number) => new Date(now - ms).toISOString()
  it('buckets into Marathi relative time', () => {
    expect(timeSinceMr(ago(30_000), now)).toBe('आत्ताच')
    expect(timeSinceMr(ago(5 * 60_000), now)).toBe('5 मिनिटांपूर्वी')
    expect(timeSinceMr(ago(3 * 3600_000), now)).toBe('3 तासांपूर्वी')
    expect(timeSinceMr(ago(24 * 3600_000), now)).toBe('काल')
    expect(timeSinceMr(ago(5 * 24 * 3600_000), now)).toBe('5 दिवसांपूर्वी')
    expect(timeSinceMr(ago(60 * 24 * 3600_000), now)).toBe('2 महिन्यांपूर्वी')
  })
})

describe('ageMonthsToMr', () => {
  it('renders years and months', () => {
    expect(ageMonthsToMr(30)).toBe('2 वर्षे 6 महिने')
    expect(ageMonthsToMr(12)).toBe('1 वर्षे')
    expect(ageMonthsToMr(5)).toBe('5 महिने')
  })
})
