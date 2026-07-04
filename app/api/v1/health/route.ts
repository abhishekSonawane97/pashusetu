// GET /api/v1/health — PS-006 (docs/13 §7): DB round-trip health probe for the
// uptime monitor and the post-deploy verify job. Declared in doc 13 as an
// addendum endpoint; not part of the doc 08 §2 contract surface.

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok', db: 'ok' })
  } catch {
    return Response.json({ status: 'degraded', db: 'unreachable' }, { status: 503 })
  }
}
