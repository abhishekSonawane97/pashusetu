// API-05 — GET /meta/districts (docs/08-api/README.md §2.2): district picker
// data — the 36 seeded MH districts. Public, unpaginated (doc 08 §1.4
// exemption), cacheable 24h.

import { withRoute } from '@/lib/errors/handle'
import { prisma } from '@/lib/prisma'

export const GET = withRoute(async () => {
  const districts = await prisma.district.findMany({
    orderBy: { nameEn: 'asc' },
    select: { id: true, nameEn: true, nameMr: true, state: true },
  })
  return Response.json(
    { items: districts },
    { headers: { 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
  )
})
