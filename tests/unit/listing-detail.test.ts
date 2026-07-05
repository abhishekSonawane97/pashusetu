// API-07 detail service: visibility rule (doc 08 §4.3 / BR-034), owner/admin
// field extension, view-count increment gating, and the BR-066 first-name /
// no-phone seller shape. Repo is mocked — DB-free but locks the security rules.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repositories/listing-repo', () => ({
  findDetailById: vi.fn(),
  countApprovedBySeller: vi.fn(async () => 3),
  isFavorited: vi.fn(async () => true),
  incrementViewCount: vi.fn(async () => undefined),
}))

import * as listingRepo from '@/lib/repositories/listing-repo'
import { getDetail } from '@/lib/services/listing-service'
import { AppError } from '@/lib/errors/app-error'
import type { AuthContext } from '@/lib/auth/auth-context'

const SELLER_ID = 'cseller00000000000000001'

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'clx4l01bb0001',
    sellerId: SELLER_ID,
    status: 'APPROVED',
    species: 'COW',
    breed: { id: 'b1', species: 'COW', nameEn: 'Gir', nameMr: 'गीर' },
    sex: 'FEMALE',
    ageMonths: 48,
    weightKg: 380,
    milkYieldLpd: 12,
    lactationNumber: 2,
    isPregnant: false,
    isVaccinated: true,
    priceInr: 65000,
    negotiable: true,
    description: 'चांगली गाय',
    district: { id: 'd1', nameEn: 'Satara', nameMr: 'सातारा', state: 'MH' },
    taluka: 'कोरेगाव',
    village: 'निगडी',
    images: [{ id: 'i1', sortOrder: 0, url: 'https://img/x.webp', width: 1600, height: 1200 }],
    viewCount: 148,
    rejectionReason: null,
    expiresAt: new Date('2026-08-01T00:00:00Z'),
    soldAt: null,
    declarationAccepted: true,
    declarationAt: new Date('2026-07-01T00:00:00Z'),
    approvedAt: new Date('2026-07-02T05:10:00Z'),
    createdAt: new Date('2026-07-01T06:30:00Z'),
    updatedAt: new Date('2026-07-02T05:10:00Z'),
    seller: {
      id: SELLER_ID,
      name: 'रमेश पाटील',
      village: 'निगडी',
      createdAt: new Date('2026-03-15T00:00:00Z'),
      district: { id: 'd1', nameEn: 'Satara', nameMr: 'सातारा', state: 'MH' },
    },
    ...overrides,
  }
}

const ctx = (id: string, isAdmin = false): AuthContext => ({ user: { id, isAdmin } }) as AuthContext

beforeEach(() => {
  vi.mocked(listingRepo.incrementViewCount).mockClear()
})

describe('getDetail visibility (BR-034)', () => {
  it('APPROVED is public; +1 view for anonymous; no phone, first name only', async () => {
    vi.mocked(listingRepo.findDetailById).mockResolvedValue(row() as never)
    const d = (await getDetail('clx4l01bb0001', null)) as Record<string, unknown>
    expect((d.seller as { firstName: string }).firstName).toBe('रमेश')
    expect(JSON.stringify(d)).not.toContain('phone')
    expect(d.viewer).toBeNull()
    expect(listingRepo.incrementViewCount).toHaveBeenCalledOnce()
  })

  it('non-APPROVED → 404 to the public; SOLD carries publicState=SOLD', async () => {
    vi.mocked(listingRepo.findDetailById).mockResolvedValue(row({ status: 'SOLD' }) as never)
    await expect(getDetail('x', null)).rejects.toMatchObject({
      code: 'LISTING_NOT_FOUND',
      details: { publicState: 'SOLD' },
    })
  })

  it('PENDING → 404 publicState=UNAVAILABLE, no view increment', async () => {
    vi.mocked(listingRepo.findDetailById).mockResolvedValue(row({ status: 'PENDING' }) as never)
    await expect(getDetail('x', null)).rejects.toMatchObject({
      code: 'LISTING_NOT_FOUND',
      details: { publicState: 'UNAVAILABLE' },
    })
    expect(listingRepo.incrementViewCount).not.toHaveBeenCalled()
  })

  it('missing listing → plain LISTING_NOT_FOUND (no publicState)', async () => {
    vi.mocked(listingRepo.findDetailById).mockResolvedValue(null)
    await expect(getDetail('x', null)).rejects.toBeInstanceOf(AppError)
    await expect(getDetail('x', null)).rejects.toMatchObject({ code: 'LISTING_NOT_FOUND' })
  })
})

describe('getDetail owner/admin', () => {
  it('owner sees a PENDING listing with the 6 extension fields; no view increment', async () => {
    vi.mocked(listingRepo.findDetailById).mockResolvedValue(row({ status: 'PENDING' }) as never)
    const d = (await getDetail('x', ctx(SELLER_ID))) as Record<string, unknown>
    expect(d.status).toBe('PENDING')
    expect(d).toHaveProperty('declarationAccepted')
    expect(d).toHaveProperty('expiresAt')
    expect((d.viewer as { isOwner: boolean }).isOwner).toBe(true)
    expect(listingRepo.incrementViewCount).not.toHaveBeenCalled()
  })

  it('public response omits the 6 owner-only fields entirely', async () => {
    vi.mocked(listingRepo.findDetailById).mockResolvedValue(row() as never)
    const d = (await getDetail('x', null)) as Record<string, unknown>
    for (const f of [
      'rejectionReason',
      'expiresAt',
      'soldAt',
      'declarationAccepted',
      'declarationAt',
      'updatedAt',
    ]) {
      expect(d).not.toHaveProperty(f)
    }
  })

  it('admin sees any status and does not bump view count', async () => {
    vi.mocked(listingRepo.findDetailById).mockResolvedValue(row({ status: 'REJECTED' }) as never)
    const d = (await getDetail('x', ctx('someadmin', true))) as Record<string, unknown>
    expect(d.status).toBe('REJECTED')
    expect(listingRepo.incrementViewCount).not.toHaveBeenCalled()
  })
})
