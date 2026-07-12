// GET /meta/talukas — distinct talukas (tehsils) on APPROVED listings, for the
// browse taluka filter. Optional ?districtId scopes to one district. Public.
// Derived from live listing data (taluka is free-text, BR-022), so short-cached.

import { z } from 'zod'
import { withRoute } from '@/lib/errors/handle'
import { parseQuery } from '@/lib/api/parse'
import * as listingRepo from '@/lib/repositories/listing-repo'

export const dynamic = 'force-dynamic'

const talukasQuerySchema = z.object({ districtId: z.string().min(1).optional() }).strict()

export const GET = withRoute(async (req) => {
  const { districtId } = parseQuery(req, talukasQuerySchema)
  const talukas = await listingRepo.distinctTalukas(districtId)
  return Response.json(
    { items: talukas },
    { headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  )
})
