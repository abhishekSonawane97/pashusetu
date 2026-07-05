// Integration test — the listing write path (T-01 create → guards → T-02 submit)
// against a REAL Postgres (Neon). Exercises the service + repo layers with a
// seeded test seller; the HTTP/Firebase layer is out of scope here (unit-tested
// separately). Gated on RUN_DB_TESTS so CI's `pnpm test` (dummy DB) skips it;
// wired into the doc 13 §3.2 Neon-branch integration job later.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import type { AuthContext } from '@/lib/auth/auth-context'
import { AppError } from '@/lib/errors/app-error'
import * as listingService from '@/lib/services/listing-service'
import * as listingRepo from '@/lib/repositories/listing-repo'

const RUN = process.env.RUN_DB_TESTS === '1'

describe.skipIf(!RUN)('listing write path (live Neon)', () => {
  let ctx: AuthContext
  let districtId: string
  let breedId: string
  const created: string[] = []

  beforeAll(async () => {
    const district = await prisma.district.findFirstOrThrow({ where: { nameEn: 'Pune' } })
    const breed = await prisma.breed.findFirstOrThrow({ where: { species: 'COW', nameEn: 'Gir' } })
    districtId = district.id
    breedId = breed.id
    const seller = await prisma.user.create({
      data: {
        firebaseUid: 'TEST_WP_SELLER',
        phone: '+919999900010',
        name: 'चाचणी विक्रेता',
        districtId,
      },
    })
    ctx = { user: seller } as AuthContext
  })

  afterAll(async () => {
    await prisma.listingImage.deleteMany({ where: { listingId: { in: created } } })
    await prisma.listing.deleteMany({ where: { id: { in: created } } })
    await prisma.user.deleteMany({ where: { firebaseUid: 'TEST_WP_SELLER' } })
    await prisma.$disconnect()
  })

  it('T-01: creates a DRAFT with only species', async () => {
    const d = (await listingService.createDraft(ctx, {
      species: 'COW',
      negotiable: true,
    })) as Record<string, unknown>
    created.push(d.id as string)
    expect(d.status).toBe('DRAFT')
    expect(d.declarationAccepted).toBe(false)
    expect((d.images as unknown[]).length).toBe(0)
  })

  it('submit on an incomplete DRAFT → 422 with the full missing-field map + photo guard', async () => {
    const d = (await listingService.createDraft(ctx, { species: 'COW', negotiable: true })) as {
      id: string
    }
    created.push(d.id)
    let err: AppError | null = null
    try {
      await listingService.submitListing(ctx, d.id, true)
    } catch (e) {
      err = e as AppError
    }
    expect(err?.code).toBe('VALIDATION_ERROR')
    const fields = err?.details?.fields as Record<string, string>
    expect(fields).toHaveProperty('breedId')
    expect(fields).toHaveProperty('priceInr')
    expect(fields).toHaveProperty('photos') // BR-023 ≥1 image
  })

  it('submit without declaration → DECLARATION_REQUIRED', async () => {
    const d = (await listingService.createDraft(ctx, { species: 'COW', negotiable: true })) as {
      id: string
    }
    created.push(d.id)
    await expect(listingService.submitListing(ctx, d.id, false)).rejects.toMatchObject({
      code: 'DECLARATION_REQUIRED',
    })
  })

  it('T-02: a complete DRAFT + photo submits to PENDING; search excludes it, My Listings shows it', async () => {
    const d = (await listingService.createDraft(ctx, {
      species: 'COW',
      breedId,
      sex: 'FEMALE',
      ageMonths: 48,
      milkYieldLpd: 12,
      priceInr: 65000,
      negotiable: true,
      districtId,
      village: 'निगडी',
      description: 'चांगली गीर गाय, दररोज 12 लिटर दूध देते.',
    })) as { id: string }
    created.push(d.id)
    // Simulate an attached photo (R2 pipeline lands later) to satisfy the BR-023 guard.
    await prisma.listingImage.create({
      data: {
        listingId: d.id,
        r2Key: `test/${d.id}.webp`,
        url: 'https://img-dev.pashusetu.in/x.webp',
        sortOrder: 0,
      },
    })

    const submitted = (await listingService.submitListing(ctx, d.id, true)) as Record<
      string,
      unknown
    >
    expect(submitted.status).toBe('PENDING')
    expect(submitted.declarationAccepted).toBe(true)
    expect(submitted.declarationAt).not.toBeNull()

    // Public search must NOT include a PENDING listing (BR-034 visibility).
    const search = await listingService.search({ sort: 'newest', limit: 20 } as never)
    expect(search.items.find((l) => l.id === d.id)).toBeUndefined()

    // My Listings shows it with the quota meter.
    const mine = await listingService.getOwnListings(ctx, undefined, undefined, 20)
    expect(mine.items.find((l) => l.id === d.id)?.status).toBe('PENDING')
    expect(mine.meta.activeLimit).toBe(10)
    expect(mine.meta.activeCount).toBeGreaterThanOrEqual(1)
  })

  it('BR-024: the 11th active listing is rejected with LISTING_LIMIT_REACHED', async () => {
    // Count current active for this seller, then create up to the cap and expect the next to fail.
    const before = await listingRepo.ownListings(ctx.user.id, undefined, null, 50)
    const room = 10 - before.activeCount
    for (let i = 0; i < room; i++) {
      const d = (await listingService.createDraft(ctx, { species: 'GOAT', negotiable: true })) as {
        id: string
      }
      created.push(d.id)
    }
    await expect(
      listingService.createDraft(ctx, { species: 'GOAT', negotiable: true }),
    ).rejects.toMatchObject({
      code: 'LISTING_LIMIT_REACHED',
    })
  }, 30000) // creates up to 10 listings against remote Neon — needs > the 5s default
})
