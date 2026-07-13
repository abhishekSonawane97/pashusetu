// prisma/seed.ts — docs/07-database/README.md §6. Idempotent: upserts keyed on
// natural unique keys (never cuids); safe to run any number of times in any
// environment (local, Neon preview branches, production — doc 13 §3.3 runs it
// on every production deploy). Wired via prisma.config.ts migrations.seed.
import { PrismaClient, Species } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Seeding is a CLI/migration context — use the DIRECT (non-pooled) URL (doc 07 §8.3).
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('DIRECT_URL / DATABASE_URL not set')
const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) })

// §6.1 — all 36 Maharashtra districts, current official names.
const DISTRICTS: Array<[nameEn: string, nameMr: string]> = [
  ['Ahilyanagar', 'अहिल्यानगर'],
  ['Akola', 'अकोला'],
  ['Amravati', 'अमरावती'],
  ['Beed', 'बीड'],
  ['Bhandara', 'भंडारा'],
  ['Buldhana', 'बुलढाणा'],
  ['Chandrapur', 'चंद्रपूर'],
  ['Chhatrapati Sambhajinagar', 'छत्रपती संभाजीनगर'],
  ['Dharashiv', 'धाराशिव'],
  ['Dhule', 'धुळे'],
  ['Gadchiroli', 'गडचिरोली'],
  ['Gondia', 'गोंदिया'],
  ['Hingoli', 'हिंगोली'],
  ['Jalgaon', 'जळगाव'],
  ['Jalna', 'जालना'],
  ['Kolhapur', 'कोल्हापूर'],
  ['Latur', 'लातूर'],
  ['Mumbai City', 'मुंबई शहर'],
  ['Nagpur', 'नागपूर'],
  ['Nanded', 'नांदेड'],
  ['Nandurbar', 'नंदुरबार'],
  ['Nashik', 'नाशिक'],
  ['Palghar', 'पालघर'],
  ['Parbhani', 'परभणी'],
  ['Pune', 'पुणे'],
  ['Raigad', 'रायगड'],
  ['Ratnagiri', 'रत्नागिरी'],
  ['Sangli', 'सांगली'],
  ['Satara', 'सातारा'],
  ['Sindhudurg', 'सिंधुदुर्ग'],
  ['Solapur', 'सोलापूर'],
  ['Thane', 'ठाणे'],
  ['Wardha', 'वर्धा'],
  ['Washim', 'वाशिम'],
  ['Yavatmal', 'यवतमाळ'],
  ['Mumbai Suburban', 'मुंबई उपनगर'],
]

// §6.2 — 39 breed rows; every species carries Local / Crossbred (गावठी / संकरित)
// so breed_id is always satisfiable (BR-022). Khillar exists for both COW and
// BULL_OX by design (unique per (species, name_en)).
const LOCAL: [string, string] = ['Local / Crossbred', 'गावठी / संकरित']
const BREEDS: Record<Species, Array<[nameEn: string, nameMr: string]>> = {
  COW: [
    ['Gir', 'गीर'],
    ['Sahiwal', 'साहिवाल'],
    ['Holstein Friesian (HF)', 'होल्स्टिन फ्रिजियन (एचएफ)'],
    ['Jersey', 'जर्सी'],
    ['Khillar', 'खिल्लार'],
    ['Dangi', 'डांगी'],
    ['Deoni', 'देवणी'],
    ['Gaolao', 'गवळाऊ'],
    ['Red Kandhari', 'रेड कंधारी'],
    ['Lal Kandhari', 'लाल कंधारी'],
    LOCAL,
  ],
  BUFFALO: [
    ['Murrah', 'मुऱ्हा'],
    ['Jafarabadi', 'जाफराबादी'],
    ['Mehsana', 'मेहसाणा'],
    ['Nagpuri', 'नागपुरी'],
    ['Pandharpuri', 'पंढरपुरी'],
    ['Surti', 'सुरती'],
    LOCAL,
  ],
  BULL_OX: [
    ['Khillar', 'खिल्लार'],
    ['Gir', 'गीर'],
    ['Dangi', 'डांगी'],
    ['Gaolao', 'गवळाऊ'],
    ['Deoni', 'देवणी'],
    LOCAL,
  ],
  GOAT: [
    ['Osmanabadi', 'उस्मानाबादी'],
    ['Sangamneri', 'संगमनेरी'],
    ['Boer', 'बोअर'],
    ['Sirohi', 'सिरोही'],
    LOCAL,
  ],
  SHEEP: [['Deccani', 'दख्खनी'], ['Madgyal', 'माडग्याळ'], LOCAL],
  // रेडा (he-buffalo) — shares the buffalo breed list (same animal, male).
  REDA: [
    ['Murrah', 'मुऱ्हा'],
    ['Jafarabadi', 'जाफराबादी'],
    ['Mehsana', 'मेहसाणा'],
    ['Nagpuri', 'नागपुरी'],
    ['Pandharpuri', 'पंढरपुरी'],
    ['Surti', 'सुरती'],
    LOCAL,
  ],
}

async function main() {
  for (const [nameEn, nameMr] of DISTRICTS) {
    await prisma.district.upsert({
      where: { nameEn },
      update: { nameMr },
      create: { nameEn, nameMr, state: 'MH' },
    })
  }
  console.log(`Seeded ${DISTRICTS.length} districts`)

  let breedCount = 0
  for (const [species, rows] of Object.entries(BREEDS) as [Species, [string, string][]][]) {
    for (const [nameEn, nameMr] of rows) {
      await prisma.breed.upsert({
        where: { species_nameEn: { species, nameEn } },
        update: { nameMr },
        create: { species, nameEn, nameMr },
      })
      breedCount++
    }
  }
  console.log(`Seeded ${breedCount} breeds`)

  // §6.3 — System user (BR-046): system-initiated moderation actions log under
  // this row so moderation_log.admin_id is always non-null. The sentinel
  // firebase_uid can never authenticate; the phone is reserved-invalid.
  await prisma.user.upsert({
    where: { firebaseUid: 'SYSTEM' },
    update: {},
    create: {
      firebaseUid: 'SYSTEM',
      phone: '+910000000000',
      name: 'System',
      isFarmer: false,
      isBuyer: false,
      isAdmin: true,
      status: 'ACTIVE',
    },
  })
  console.log('Seeded System user')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
