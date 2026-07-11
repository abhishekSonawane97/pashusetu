// API-21 — POST /listings/{id}/interest (doc 08 §2.7): the single, logged
// phone-reveal path (BR-062). Login + complete profile required (BR-061); the
// service enforces APPROVED-only, not-own-listing, and the 20/day cap (BR-064).
// Returns 201 with the seller phone + server-built wa.me link — the only payload
// in the system that carries a phone (BR-066).

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { verifyAuth, requireProfile } from '@/lib/auth/verify-auth'
import { interestSchema } from '@/lib/validation/listings'
import * as interestService from '@/lib/services/interest-service'

export const POST = withRoute(async (req, ctxParams) => {
  const ctx = await verifyAuth(req)
  requireProfile(ctx)
  const { id } = await ctxParams.params
  const { type } = await parseJsonBody(req, interestSchema)
  const result = await interestService.logInterestAndReveal(ctx, id, type)
  return Response.json(result, { status: 201 })
})
