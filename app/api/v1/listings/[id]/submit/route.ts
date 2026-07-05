// API-10 — POST /listings/{id}/submit (doc 08 §2.4): submit for moderation
// (T-02 DRAFT→PENDING or T-05 REJECTED→PENDING). The moment of legal
// declaration (BR-027). Owner only.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { verifyAuth, requireProfile } from '@/lib/auth/verify-auth'
import { submitListingSchema } from '@/lib/validation/listings'
import * as listingService from '@/lib/services/listing-service'

export const POST = withRoute(async (req, ctxParams) => {
  const ctx = await verifyAuth(req)
  requireProfile(ctx)
  const { id } = await ctxParams.params
  const body = await parseJsonBody(req, submitListingSchema)
  const detail = await listingService.submitListing(ctx, id, body.declarationAccepted)
  return Response.json(detail)
})
