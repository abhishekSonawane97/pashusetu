// API-14 — GET /users/me/listings (doc 08 §2.3): My Listings hub, the only way
// a seller sees their own non-APPROVED listings (BR-034, S-11). Optional status
// filter, keyset pagination, + meta quota meter (activeCount / activeLimit).

import { withRoute } from '@/lib/errors/handle'
import { parseQuery } from '@/lib/api/parse'
import { verifyAuth } from '@/lib/auth/verify-auth'
import { listingStatusSchema, paginationSchema } from '@/lib/validation/common'
import * as listingService from '@/lib/services/listing-service'

export const dynamic = 'force-dynamic'

const querySchema = paginationSchema.extend({ status: listingStatusSchema.optional() }).strict()

export const GET = withRoute(async (req) => {
  const ctx = await verifyAuth(req)
  const { status, cursor, limit } = parseQuery(req, querySchema)
  const page = await listingService.getOwnListings(ctx, status, cursor, limit)
  return Response.json(page)
})
