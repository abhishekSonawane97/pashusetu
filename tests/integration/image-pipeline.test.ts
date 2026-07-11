// Integration test — the full image pipeline against REAL storage (MinIO, S3-
// compatible) + Neon: presign → browser-style PUT → attach (magic-bytes check +
// sharp WebP variants) → public variant is fetchable → submit now clears the
// BR-023 photo guard. Gated on RUN_DB_TESTS (needs MinIO on :9000 + Neon).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import type { AuthContext } from '@/lib/auth/auth-context'
import * as listingService from '@/lib/services/listing-service'
import * as imageService from '@/lib/services/image-service'

const RUN = process.env.RUN_DB_TESTS === '1'

describe.skipIf(!RUN)('image pipeline (live MinIO + Neon)', () => {
  let ctx: AuthContext
  let listingId: string
  const cleanup: string[] = []

  beforeAll(async () => {
    const district = await prisma.district.findFirstOrThrow({ where: { nameEn: 'Pune' } })
    const breed = await prisma.breed.findFirstOrThrow({ where: { species: 'COW', nameEn: 'Gir' } })
    const seller = await prisma.user.create({
      data: {
        firebaseUid: 'TEST_IMG_SELLER',
        phone: '+919999900020',
        name: 'फोटो विक्रेता',
        districtId: district.id,
      },
    })
    ctx = { user: seller } as AuthContext
    const d = (await listingService.createDraft(ctx, {
      species: 'COW',
      breedId: breed.id,
      sex: 'FEMALE',
      ageMonths: 48,
      milkYieldLpd: 12,
      priceInr: 65000,
      negotiable: true,
      districtId: district.id,
      taluka: 'हवेली',
      village: 'निगडी',
      description: 'चांगली गीर गाय, दररोज 12 लिटर दूध देते.',
    })) as { id: string }
    listingId = d.id
    cleanup.push(d.id)
  })

  afterAll(async () => {
    await prisma.listingImage.deleteMany({ where: { listingId: { in: cleanup } } })
    await prisma.listing.deleteMany({ where: { id: { in: cleanup } } })
    await prisma.user.deleteMany({ where: { firebaseUid: 'TEST_IMG_SELLER' } })
    await prisma.$disconnect()
  })

  it('presign → PUT a real JPEG → attach → public WebP variants are fetchable', async () => {
    // A real JPEG the magic-bytes check will accept.
    const jpeg = await sharp({
      create: { width: 1200, height: 900, channels: 3, background: { r: 120, g: 90, b: 40 } },
    })
      .jpeg()
      .toBuffer()

    // API-15 presign.
    const { key, uploadUrl, headers } = await imageService.presign(ctx, {
      listingId,
      contentType: 'image/jpeg',
      sizeBytes: jpeg.length,
    })
    expect(key).toContain(`listings/${listingId}/original/`)

    // Browser-style PUT to MinIO with the exact signed headers.
    const put = await fetch(uploadUrl, { method: 'PUT', headers, body: jpeg })
    expect(put.status).toBe(200)

    // API-16 attach — sharp generates the 3 WebP variants into the public bucket.
    const image = (await imageService.attachImage(ctx, listingId, { key })) as {
      id: string
      urls: { thumb: string; card: string; detail: string }
    }
    expect(image.urls.detail).toMatch(/\/detail\.webp$/)

    // The public card variant is actually fetchable and is a WebP.
    const got = await fetch(image.urls.card)
    expect(got.status).toBe(200)
    expect(got.headers.get('content-type')).toContain('image/webp')
  }, 30000)

  it('with 3 photos attached, submit clears the BR-023 min-3 guard → PENDING', async () => {
    // Test 1 attached 1 photo; BR-023 requires ≥ 3 at submit → add 2 more via the real pipeline.
    const png = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 80, b: 40 } },
    })
      .png()
      .toBuffer()
    for (let i = 0; i < 2; i++) {
      const { key, uploadUrl, headers } = await imageService.presign(ctx, {
        listingId,
        contentType: 'image/png',
        sizeBytes: png.length,
      })
      await fetch(uploadUrl, { method: 'PUT', headers, body: png })
      await imageService.attachImage(ctx, listingId, { key })
    }

    const submitted = (await listingService.submitListing(ctx, listingId, true)) as Record<
      string,
      unknown
    >
    expect(submitted.status).toBe('PENDING')
    // Detail now carries the image with all three variant URLs.
    expect((submitted.images as { urls: { card: string } }[])[0].urls.card).toMatch(/\/card\.webp$/)
  }, 30000)

  it('photo cap: attaching a 6th image is rejected (BR-023, PHOTO_LIMIT_EXCEEDED)', async () => {
    // Fill to the cap of 5 (3 attached above → add 2 more), then the 6th fails.
    const png = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer()
    for (let i = 0; i < 2; i++) {
      const { key, uploadUrl, headers } = await imageService.presign(ctx, {
        listingId,
        contentType: 'image/png',
        sizeBytes: png.length,
      })
      await fetch(uploadUrl, { method: 'PUT', headers, body: png })
      await imageService.attachImage(ctx, listingId, { key })
    }
    const { key, uploadUrl, headers } = await imageService.presign(ctx, {
      listingId,
      contentType: 'image/png',
      sizeBytes: png.length,
    })
    await fetch(uploadUrl, { method: 'PUT', headers, body: png })
    await expect(imageService.attachImage(ctx, listingId, { key })).rejects.toMatchObject({
      code: 'PHOTO_LIMIT_EXCEEDED',
    })
  }, 40000)
})
