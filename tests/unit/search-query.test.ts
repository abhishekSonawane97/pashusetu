// GET /listings query validation (doc 08 §4.1): defaults, sort enum, price
// bounds, minPrice<=maxPrice, strict unknown-key rejection.
import { describe, expect, it } from 'vitest'
import { searchQuerySchema } from '@/lib/validation/search'

describe('searchQuerySchema', () => {
  it('applies defaults: sort=newest, limit=20', () => {
    expect(searchQuerySchema.parse({})).toMatchObject({ sort: 'newest', limit: 20 })
  })

  it('coerces numeric query strings', () => {
    const q = searchQuerySchema.parse({ minPrice: '5000', maxPrice: '80000', limit: '30' })
    expect(q).toMatchObject({ minPrice: 5000, maxPrice: 80000, limit: 30 })
  })

  it('rejects minPrice > maxPrice (F-04 AC-4)', () => {
    expect(searchQuerySchema.safeParse({ minPrice: '90000', maxPrice: '5000' }).success).toBe(false)
  })

  it('rejects unknown species, bad sort, limit > 50, and unknown keys', () => {
    expect(searchQuerySchema.safeParse({ species: 'HORSE' }).success).toBe(false)
    expect(searchQuerySchema.safeParse({ sort: 'cheapest' }).success).toBe(false)
    expect(searchQuerySchema.safeParse({ limit: '51' }).success).toBe(false)
    expect(searchQuerySchema.safeParse({ q: 'gir cow' }).success).toBe(false) // no free-text in MVP
  })

  it('accepts a full valid filter set', () => {
    const q = searchQuerySchema.parse({
      species: 'COW',
      districtId: 'cdist1',
      minPrice: '10000',
      maxPrice: '100000',
      sort: 'price_asc',
      limit: '20',
    })
    expect(q.species).toBe('COW')
    expect(q.sort).toBe('price_asc')
  })
})
