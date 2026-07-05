// API-06 — GET /listings (doc 08 §4): public search over APPROVED listings with
// filters, sort, cursor pagination. No auth. POST /listings (create DRAFT) lands
// with the wizard slice (API-08).

import { withRoute } from '@/lib/errors/handle'
import { parseQuery } from '@/lib/api/parse'
import { searchQuerySchema } from '@/lib/validation/search'
import * as listingService from '@/lib/services/listing-service'

export const dynamic = 'force-dynamic' // search is always live (doc 09 §12)

export const GET = withRoute(async (req) => {
  const query = parseQuery(req, searchQuerySchema)
  const page = await listingService.search(query)
  return Response.json(page)
})
