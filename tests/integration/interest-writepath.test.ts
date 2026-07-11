// Integration test — the interest / phone-reveal path (API-21 / F-06) against a
// REAL Postgres (Neon). Exercises the service + repo layers: an interest_events
// row is logged and the seller phone + wa.me link are revealed in ONE transaction;
// the guards (APPROVED-only, not-own-listing, BR-064 20/day cap) all fire. The
// HTTP/Firebase auth layer (verifyAuth/requireProfile) is out of scope here.
// Gated on RUN_DB_TESTS so CI's dummy-DB `pnpm test` skips it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import type { AuthContext } from '@/lib/auth/auth-context'
import { AppError } from '@/lib/errors/app-error'
import * as interestService from '@/lib/services/interest-service'

const RUN = process.env.RUN_DB_TESTS === '1'

const UIDS = ['TEST_INT_SELLER', 'TEST_INT_BUYER', 'TEST_INT_BUYER_RL']
const SELLER_PHONE = '+919999900030'

describe.skipIf(!RUN)('interest write path (live Neon)', () => {
  let buyerCtx: AuthContext
  let sellerCtx: AuthContext
  let rlBuyerCtx: AuthContext
  let approvedId: string
  let draftId: string
  const createdListings: string[] = []

  beforeAll(async () => {
    const district = await prisma.district.findFirstOrThrow({ where: { nameEn: 'Pune' } })
    const breed = await prisma.breed.findFirstOrThrow({ where: { species: 'COW', nameEn: 'Gir' } })

    const seller = await prisma.user.create({
      data: {
        firebaseUid: UIDS[0],
        phone: SELLER_PHONE,
        name: 'गीता विक्रेता',
        districtId: district.id,
      },
    })
    const buyer = await prisma.user.create({
      data: {
        firebaseUid: UIDS[1],
        phone: '+919999900031',
        name: 'खरेदीदार एक',
        districtId: district.id,
      },
    })
    const rlBuyer = await prisma.user.create({
      data: {
        firebaseUid: UIDS[2],
        phone: '+919999900032',
        name: 'खरेदीदार दोन',
        districtId: district.id,
      },
    })
    sellerCtx = { user: seller } as AuthContext
    buyerCtx = { user: buyer } as AuthContext
    rlBuyerCtx = { user: rlBuyer } as AuthContext

    const now = new Date()
    const base = {
      sellerId: seller.id,
      species: 'COW' as const,
      breedId: breed.id,
      sex: 'FEMALE' as const,
      ageMonths: 48,
      milkYieldLpd: 12,
      priceInr: 65000,
      negotiable: true,
      districtId: district.id,
      taluka: 'हवेली',
      village: 'निगडी',
      description: 'चांगली गीर गाय.',
    }
    const approved = await prisma.listing.create({
      data: {
        ...base,
        status: 'APPROVED',
        declarationAccepted: true,
        declarationAt: now,
        approvedAt: now,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    })
    const draft = await prisma.listing.create({
      data: { ...base, status: 'DRAFT' },
      select: { id: true },
    })
    approvedId = approved.id
    draftId = draft.id
    createdListings.push(approvedId, draftId)
  })

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { firebaseUid: { in: UIDS } },
      select: { id: true },
    })
    const buyerIds = users.map((u) => u.id)
    await prisma.interestEvent.deleteMany({ where: { buyerId: { in: buyerIds } } })
    await prisma.listing.deleteMany({ where: { id: { in: createdListings } } })
    await prisma.user.deleteMany({ where: { firebaseUid: { in: UIDS } } })
    await prisma.$disconnect()
  })

  it('CALL: logs one interest_events row and reveals phone + wa.me link', async () => {
    const before = await prisma.interestEvent.count({ where: { buyerId: buyerCtx.user.id } })
    const res = await interestService.logInterestAndReveal(buyerCtx, approvedId, 'CALL')

    expect(res.type).toBe('CALL')
    expect(res.listingId).toBe(approvedId)
    expect(res.seller.phone).toBe(SELLER_PHONE)
    expect(res.seller.name).toBe('गीता') // first name only (BR-066)
    expect(res.seller.whatsappUrl.startsWith('https://wa.me/919999900030?text=')).toBe(true)

    const after = await prisma.interestEvent.count({ where: { buyerId: buyerCtx.user.id } })
    expect(after).toBe(before + 1)
  })

  it('repeat taps each log a fresh row (no dedup, BR-062)', async () => {
    const before = await prisma.interestEvent.count({ where: { buyerId: buyerCtx.user.id } })
    await interestService.logInterestAndReveal(buyerCtx, approvedId, 'WHATSAPP')
    await interestService.logInterestAndReveal(buyerCtx, approvedId, 'INTEREST')
    const after = await prisma.interestEvent.count({ where: { buyerId: buyerCtx.user.id } })
    expect(after).toBe(before + 2)
  })

  it('every type returns the identical reveal shape', async () => {
    for (const type of ['CALL', 'WHATSAPP', 'INTEREST'] as const) {
      const res = await interestService.logInterestAndReveal(buyerCtx, approvedId, type)
      expect(res.seller.phone).toBe(SELLER_PHONE)
      expect(res.seller.whatsappUrl).toContain('wa.me/919999900030')
      expect(res.type).toBe(type)
    }
  })

  it('the seller contacting their own listing → FORBIDDEN / OWN_LISTING', async () => {
    let err: AppError | null = null
    try {
      await interestService.logInterestAndReveal(sellerCtx, approvedId, 'CALL')
    } catch (e) {
      err = e as AppError
    }
    expect(err?.code).toBe('FORBIDDEN')
    expect(err?.details?.reason).toBe('OWN_LISTING')
  })

  it('a non-APPROVED listing → LISTING_NOT_FOUND (masks existence, BR-066)', async () => {
    await expect(
      interestService.logInterestAndReveal(buyerCtx, draftId, 'CALL'),
    ).rejects.toMatchObject({ code: 'LISTING_NOT_FOUND' })
  })

  it('the 21st event in 24h → RATE_LIMITED (BR-064, 20/day)', async () => {
    // Pre-seed exactly 20 events in the window for a fresh buyer.
    await prisma.interestEvent.createMany({
      data: Array.from({ length: 20 }, () => ({
        listingId: approvedId,
        buyerId: rlBuyerCtx.user.id,
        type: 'CALL' as const,
      })),
    })
    let err: AppError | null = null
    try {
      await interestService.logInterestAndReveal(rlBuyerCtx, approvedId, 'CALL')
    } catch (e) {
      err = e as AppError
    }
    expect(err?.code).toBe('RATE_LIMITED')
    expect(Number(err?.details?.retryAfterSeconds)).toBeGreaterThan(0)
    // The blocked attempt must NOT have logged a 21st row.
    const count = await prisma.interestEvent.count({ where: { buyerId: rlBuyerCtx.user.id } })
    expect(count).toBe(20)
  })
})
