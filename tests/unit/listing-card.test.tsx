// @vitest-environment jsdom
// ListingCard: design hard rule 3 — unset optional fields are OMITTED entirely
// (never rendered as "–"/"N/A"); price uses Indian grouping; badges conditional.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ListingCard } from '@/components/listings/ListingCard'
import type { ListingCard as ListingCardData } from '@/lib/api/types'

const base: ListingCardData = {
  id: 'clx4l01bb0001l404gt6yh1n2',
  species: 'COW',
  breed: { id: 'b1', species: 'COW', nameEn: 'Gir', nameMr: 'गीर' },
  sex: 'FEMALE',
  ageMonths: 48,
  priceInr: 65000,
  negotiable: true,
  isPregnant: false,
  milkYieldLpd: 12,
  district: { id: 'd1', nameEn: 'Satara', nameMr: 'सातारा', state: 'MH' },
  taluka: 'कोरेगाव',
  village: 'निगडी',
  thumbnailUrl: null,
  approvedAt: new Date().toISOString(),
}

afterEach(cleanup)

describe('ListingCard', () => {
  it('renders price with Indian grouping + ₹, and species/breed in Marathi', () => {
    render(<ListingCard listing={base} />)
    expect(screen.getByText('₹65,000')).toBeDefined()
    expect(screen.getByText('गीर गाय')).toBeDefined()
    expect(screen.getByText('12 लि/दिवस')).toBeDefined()
  })

  it('omits the milk-yield badge entirely when milkYieldLpd is null (hard rule 3)', () => {
    render(<ListingCard listing={{ ...base, milkYieldLpd: null }} />)
    expect(screen.queryByText(/लि\/दिवस/)).toBeNull()
  })

  it('omits milk badge when yield is 0 (dry) and pregnancy badge when not pregnant', () => {
    render(<ListingCard listing={{ ...base, milkYieldLpd: 0, isPregnant: false }} />)
    expect(screen.queryByText(/लि\/दिवस/)).toBeNull()
    expect(screen.queryByText('गाभण')).toBeNull()
  })

  it('shows the pregnancy badge only when isPregnant is true', () => {
    render(<ListingCard listing={{ ...base, isPregnant: true }} />)
    expect(screen.getByText('गाभण')).toBeDefined()
  })

  it('links to the listing detail route', () => {
    render(<ListingCard listing={base} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/listings/clx4l01bb0001l404gt6yh1n2')
  })
})
