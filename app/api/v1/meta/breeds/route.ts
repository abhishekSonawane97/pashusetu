// API-04 — GET /meta/breeds?species= (docs/08-api/README.md §2.2): breed picker
// data. Public, bounded reference list (≤ ~40 rows) — deliberately unpaginated
// (doc 08 §1.4 exemption). Cacheable 24h with a week of stale-while-revalidate.

import { withRoute } from '@/lib/errors/handle'
import { parseQuery } from '@/lib/api/parse'
import { speciesSchema } from '@/lib/validation/common'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const querySchema = z.object({ species: speciesSchema.optional() })

export const GET = withRoute(async (req) => {
  const { species } = parseQuery(req, querySchema)
  const breeds = await prisma.breed.findMany({
    where: species ? { species } : undefined,
    orderBy: [{ species: 'asc' }, { createdAt: 'asc' }], // seed order: locals last (doc 08 API-04)
    select: { id: true, species: true, nameEn: true, nameMr: true },
  })
  return Response.json(
    { items: breeds },
    { headers: { 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
  )
})
