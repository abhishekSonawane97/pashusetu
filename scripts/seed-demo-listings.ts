// scripts/seed-demo-listings.ts — DEV/DEMO ONLY. NOT wired into `prisma db seed`
// (that runs on every prod deploy — this must never touch prod). Populates the
// marketplace with 10 APPROVED listings per species (COW/BUFFALO/BULL_OX/GOAT/
// SHEEP) across a set of seed sellers, each with a generated cover image
// processed into the same thumb/card/detail WebP variants + key scheme as the
// real pipeline (lib/r2). Every listing carries a taluka (now compulsory, BR-022).
// (REDA/he-buffalo is retired from the marketplace and is not seeded.)
// Idempotent: wipes prior seed-seller listings first. Run from the repo root:
//   node --import tsx scripts/seed-demo-listings.ts
//
// SEED_ONLY=<SPECIES> restricts the run to one species: it wipes + recreates only
// that species' seed listings and leaves the others untouched. e.g.:
//   SEED_ONLY=COW node --import tsx scripts/seed-demo-listings.ts
//
// Reads .env.local itself so it works as a plain script (no prisma-db-seed env).

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

// --- load .env.local into process.env (runs before any client is constructed
// below; static imports above have no env-dependent side effects) ---
for (const raw of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(raw.trim())
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

type Species = 'COW' | 'BUFFALO' | 'BULL_OX' | 'GOAT' | 'SHEEP'
type Sex = 'FEMALE' | 'MALE'

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('DIRECT_URL / DATABASE_URL not set (need .env.local)')
const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) })

const s3 = new S3Client({
  // Mirror lib/r2/client.ts so the seed works against any S3 provider (R2/Supabase/
  // MinIO): real region for SigV4 (Supabase/AWS validate it), and WHEN_REQUIRED so
  // the SDK doesn't stamp CRC32 flexible-checksum params that Supabase/R2 reject.
  region: process.env.R2_REGION ?? 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: process.env.R2_FORCE_PATH_STYLE === '1',
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})
const BUCKET = process.env.R2_BUCKET ?? 'pashusetu-dev'
const UPLOADS = `${BUCKET}-uploads`
const PUBLIC = `${BUCKET}-public`
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE_URL ?? 'http://localhost:9000/pashusetu-dev-public'
const VARIANTS: Array<['thumb' | 'card' | 'detail', number]> = [
  ['thumb', 400],
  ['card', 800],
  ['detail', 1600],
]

// --- demo content -----------------------------------------------------------
// A single demo seller owns every seed listing so all demo contact routes to ONE
// operator-controlled number — a demo listing must NEVER dial a real stranger.
// The number comes from DEMO_SELLER_PHONE in .env.local (gitignored) so a real
// personal number never lands in git; the committed fallback is a non-dialable
// placeholder (0-prefixed = not a valid mobile) for bare local dev.
const DEMO_SELLER_NAME = 'पशुसेतू डेमो'
const DEMO_SELLER_PHONE = process.env.DEMO_SELLER_PHONE ?? '+910000000009'
// tehsils keyed by district nameEn (the two pilot districts, doc 00 update).
const TALUKAS: Record<string, string[]> = {
  'Chhatrapati Sambhajinagar': ['पैठण', 'गंगापूर', 'वैजापूर', 'सिल्लोड', 'कन्नड', 'फुलंब्री'],
  Ahilyanagar: ['श्रीरामपूर', 'संगमनेर', 'राहुरी', 'कोपरगाव', 'नेवासा', 'पारनेर'],
}
const VILLAGES = [
  'वडगाव',
  'पिंपळगाव',
  'शिरसगाव',
  'बाभूळगाव',
  'कोळगाव',
  'देवगाव',
  'सावरगाव',
  'नांदगाव',
  'मांजरी',
  'तळेगाव',
]
const DESC: Record<Species, string> = {
  COW: 'निरोगी दुधाळ गाय, चांगली जात, नियमित लसीकरण झालेले आहे. शांत स्वभाव.',
  BUFFALO: 'जास्त दूध देणारी म्हैस, मजबूत बांधा, वेळेवर लसीकरण केलेले आहे.',
  BULL_OX: 'शेतीकामासाठी उत्तम बैल, ताकदवान आणि मेहनती, चांगल्या जातीचा.',
  GOAT: 'निरोगी शेळी, चांगली वाढ, मांस व दुधासाठी उत्तम, लसीकरण पूर्ण.',
  SHEEP: 'निरोगी मेंढी, चांगली लोकर व मांस, कळपासाठी योग्य, तंदुरुस्त.',
}
const PLAN: Record<
  Species,
  {
    sex: Sex
    price: [number, number]
    age: [number, number]
    milk?: [number, number]
    color: { r: number; g: number; b: number }
  }
> = {
  COW: {
    sex: 'FEMALE',
    price: [40000, 95000],
    age: [24, 84],
    milk: [6, 15],
    color: { r: 150, g: 111, b: 74 },
  },
  BUFFALO: {
    sex: 'FEMALE',
    price: [50000, 130000],
    age: [30, 96],
    milk: [7, 16],
    color: { r: 74, g: 78, b: 86 },
  },
  BULL_OX: { sex: 'MALE', price: [30000, 75000], age: [30, 108], color: { r: 168, g: 140, b: 96 } },
  GOAT: {
    sex: 'FEMALE',
    price: [7000, 22000],
    age: [8, 36],
    milk: [1, 3],
    color: { r: 120, g: 132, b: 72 },
  },
  SHEEP: { sex: 'FEMALE', price: [6000, 16000], age: [8, 36], color: { r: 214, g: 205, b: 182 } },
}
const SPECIES_EN: Record<Species, string> = {
  COW: 'Cow',
  BUFFALO: 'Buffalo',
  BULL_OX: 'Bullock',
  GOAT: 'Goat',
  SHEEP: 'Sheep',
}
const PER_SPECIES = 10

const pick = <T>(arr: T[], i: number): T => arr[i % arr.length]
const between = ([lo, hi]: [number, number], t: number) => Math.round(lo + (hi - lo) * t)

// Real demo photos live in scripts/seed-assets/<species>/*.jpg (gitignored — sourced
// from Wikimedia Commons for the demo). If present, we use a real photo (cycled by
// listing index) so the marketplace shows actual animals; otherwise we fall back to
// the generated placeholder art so the seed still runs on a bare checkout.
const ASSET_DIR = join(process.cwd(), 'scripts', 'seed-assets')
function realPhotos(species: Species): string[] {
  const dirName = species.toLowerCase()
  const dir = join(ASSET_DIR, dirName)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort()
    .map((f) => join(dir, f))
}

async function makeCover(species: Species, breedEn: string, n: number) {
  const photos = realPhotos(species)
  if (photos.length > 0) {
    // Cycle through the available real photos; normalize to the card aspect + WebP.
    const src = readFileSync(photos[(n - 1) % photos.length])
    return sharp(src)
      .resize({ width: 1000, height: 750, fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer()
  }
  // Fallback: generated placeholder art (bare checkout with no seed-assets).
  const { color } = PLAN[species]
  const svg = Buffer.from(
    `<svg width="1000" height="750" xmlns="http://www.w3.org/2000/svg">
       <text x="60" y="130" font-size="76" font-family="sans-serif" fill="rgba(255,255,255,0.9)">${SPECIES_EN[species]} #${n}</text>
       <text x="60" y="215" font-size="46" font-family="sans-serif" fill="rgba(255,255,255,0.75)">${breedEn}</text>
     </svg>`,
  )
  return sharp({ create: { width: 1000, height: 750, channels: 3, background: color } })
    .composite([{ input: svg, top: 0, left: 0 }])
    .webp({ quality: 82 })
    .toBuffer()
}

async function attachCover(listingId: string, species: Species, breedEn: string, n: number) {
  const cuid = 'c' + randomBytes(16).toString('hex') // 33 chars, cuid-shaped
  const original = await makeCover(species, breedEn, n)
  // Original into the private uploads bucket (parity with the real pipeline).
  await s3.send(
    new PutObjectCommand({
      Bucket: UPLOADS,
      Key: `listings/${listingId}/original/${cuid}.webp`,
      Body: original,
      ContentType: 'image/webp',
    }),
  )
  // Processed WebP variants into the public bucket at the pipeline's key scheme.
  for (const [variant, width] of VARIANTS) {
    const buf = await sharp(original).resize({ width }).webp({ quality: 80 }).toBuffer()
    await s3.send(
      new PutObjectCommand({
        Bucket: PUBLIC,
        Key: `listings/${listingId}/${cuid}/${variant}.webp`,
        Body: buf,
        ContentType: 'image/webp',
      }),
    )
  }
  await prisma.listingImage.create({
    data: {
      id: cuid,
      listingId,
      r2Key: `listings/${listingId}/original/${cuid}.webp`,
      url: `${PUBLIC_BASE}/listings/${listingId}/${cuid}`, // variant base; +/{variant}.webp at read
      sortOrder: 0,
      width: 1000,
      height: 750,
    },
  })
}

async function main() {
  const districts = await prisma.district.findMany({
    where: { nameEn: { in: Object.keys(TALUKAS) } },
    select: { id: true, nameEn: true },
  })
  if (districts.length < 2)
    throw new Error('pilot districts not seeded — run `pnpm prisma db seed` first')
  const breeds = await prisma.breed.findMany({ select: { id: true, species: true, nameEn: true } })
  const breedsBy = (sp: Species) => breeds.filter((b) => b.species === sp)

  // SEED_ONLY=<SPECIES> narrows the run to one species (wipe + recreate just that
  // one, leaving the rest of the marketplace intact).
  const onlyRaw = process.env.SEED_ONLY?.trim().toUpperCase()
  if (onlyRaw && !(onlyRaw in PLAN)) throw new Error(`SEED_ONLY="${onlyRaw}" is not a known species`)
  const only = onlyRaw as Species | undefined
  const speciesToSeed = only ? [only] : (Object.keys(PLAN) as Species[])

  // Idempotent: wipe prior seed-seller data (listing_images cascade on delete).
  // In SEED_ONLY mode, wipe only that species so other listings are untouched.
  const prior = await prisma.user.findMany({
    where: { firebaseUid: { startsWith: 'seed-' } }, // 'seed-demo-seller' + legacy 'seed-farmer-*'
    select: { id: true },
  })
  if (prior.length) {
    const del = await prisma.listing.deleteMany({
      where: { sellerId: { in: prior.map((u) => u.id) }, ...(only ? { species: only } : {}) },
    })
    console.log(`cleared ${del.count} prior demo listings${only ? ` (${only} only)` : ''}`)
  }

  // One demo seller owns every seed listing (see the DEMO_SELLER_PHONE note above)
  // — keeps all demo contact on the single operator-controlled number. Phone is in
  // the update clause too, so re-runs re-sync it from the env.
  const demoSeller = await prisma.user.upsert({
    where: { firebaseUid: 'seed-demo-seller' },
    update: { name: DEMO_SELLER_NAME, phone: DEMO_SELLER_PHONE, districtId: districts[0].id },
    create: {
      firebaseUid: 'seed-demo-seller',
      phone: DEMO_SELLER_PHONE,
      name: DEMO_SELLER_NAME,
      isFarmer: true,
      isBuyer: true,
      districtId: districts[0].id,
      status: 'ACTIVE',
    },
    select: { id: true },
  })

  const now = Date.now()
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
  let made = 0
  let k = 0
  for (const species of speciesToSeed) {
    const plan = PLAN[species]
    const spBreeds = breedsBy(species)
    for (let n = 1; n <= PER_SPECIES; n++, k++) {
      const t = (n - 1) / (PER_SPECIES - 1) // 0..1 across the batch
      const district = districts[k % districts.length]
      const breed = pick(spBreeds, n)
      const createdAt = new Date(now - k * 90_000) // stagger for a stable browse order
      const listing = await prisma.listing.create({
        data: {
          sellerId: demoSeller.id,
          species,
          breedId: breed.id,
          sex: plan.sex,
          ageMonths: between(plan.age, t),
          weightKg:
            species === 'GOAT' || species === 'SHEEP'
              ? between([25, 60], t)
              : between([250, 550], t),
          milkYieldLpd: plan.milk ? between(plan.milk, t) : null,
          isPregnant: plan.sex === 'FEMALE' && species !== 'SHEEP' ? n % 3 === 0 : null,
          isVaccinated: n % 2 === 0,
          priceInr: between(plan.price, t),
          negotiable: n % 2 === 0,
          districtId: district.id,
          taluka: pick(TALUKAS[district.nameEn], n),
          village: pick(VILLAGES, k),
          description: DESC[species],
          status: 'APPROVED',
          declarationAccepted: true,
          declarationAt: createdAt,
          approvedAt: createdAt,
          expiresAt: new Date(createdAt.getTime() + THIRTY_DAYS),
          createdAt,
        },
        select: { id: true },
      })
      await attachCover(listing.id, species, breed.nameEn, n)
      made++
    }
    console.log(`  ${species}: ${PER_SPECIES} APPROVED listings`)
  }
  console.log(`Seeded ${made} demo listings (seller: ${DEMO_SELLER_NAME}).`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
