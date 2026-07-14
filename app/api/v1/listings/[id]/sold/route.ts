// API — POST /listings/{id}/sold (T-06): the owner marks their APPROVED listing
// SOLD so buyers stop contacting them about an animal they no longer have. Owner
// only; no body. APPROVED → SOLD (any other state → INVALID_STATE_TRANSITION).

import { withRoute } from '@/lib/errors/handle'
import { verifyAuth, requireProfile } from '@/lib/auth/verify-auth'
import * as listingService from '@/lib/services/listing-service'

export const POST = withRoute(async (req, ctxParams) => {
  const ctx = await verifyAuth(req)
  requireProfile(ctx)
  const { id } = await ctxParams.params
  const detail = await listingService.markSold(ctx, id)
  return Response.json(detail)
})
