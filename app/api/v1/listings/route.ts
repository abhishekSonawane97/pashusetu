// API-06 — GET /listings (doc 08 §4): public search over APPROVED listings with
// filters, sort, cursor pagination. No auth. POST /listings (create DRAFT) lands
// with the wizard slice (API-08).

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody, parseQuery } from '@/lib/api/parse'
import { verifyAuth, requireProfile } from '@/lib/auth/verify-auth'
import { searchQuerySchema } from '@/lib/validation/search'
import { createListingSchema } from '@/lib/validation/listings'
import * as listingService from '@/lib/services/listing-service'

export const dynamic = 'force-dynamic' // search is always live (doc 09 §12)

// API-06 — public search over APPROVED listings.
export const GET = withRoute(async (req) => {
  const query = parseQuery(req, searchQuerySchema)
  const page = await listingService.search(query)
  return Response.json(page)
})

// API-08 — create a DRAFT (T-01). User+Profile required (BR-020).
export const POST = withRoute(async (req) => {
  const ctx = await verifyAuth(req)
  requireProfile(ctx)
  const input = await parseJsonBody(req, createListingSchema)
  const detail = await listingService.createDraft(ctx, input)
  return Response.json(detail, { status: 201 })
})
