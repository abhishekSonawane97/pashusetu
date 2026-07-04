// Founder admin bootstrap — docs/07-database/README.md §6.3 (BR-012: there is
// deliberately NO UI or API path to grant admin, ever).
// Usage: pnpm grant-admin +91XXXXXXXXXX [--revoke]
// Every grant/revoke must be noted in the ops journal (doc 13 §4.4).
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DIRECT_URL
if (!connectionString) throw new Error('DIRECT_URL not set — run against the direct Neon URL')

const phone = process.argv[2]
const revoke = process.argv.includes('--revoke')
if (!phone || !/^\+91[6-9]\d{9}$/.test(phone)) {
  console.error('Usage: pnpm grant-admin +91XXXXXXXXXX [--revoke]')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) })

prisma.user
  .update({ where: { phone }, data: { isAdmin: !revoke } })
  .then((u) => {
    console.log(`${revoke ? 'Revoked admin from' : 'Granted admin to'} ${u.name} (${u.id})`)
    console.log('Verify: GET /users/me returns isAdmin, then note this change in the ops journal.')
    return prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e.code === 'P2025' ? `No user with phone ${phone} — log in once first.` : e)
    await prisma.$disconnect()
    process.exit(1)
  })
