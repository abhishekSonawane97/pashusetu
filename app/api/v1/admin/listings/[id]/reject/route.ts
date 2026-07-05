// API-27 — POST /admin/listings/{id}/reject (T-04 PENDING→REJECTED). Admin only.
// Reason is a mandatory BR-043 taxonomy code (detail required for OTHER); it is
// stored on the listing and travels verbatim to the seller. One transaction
// writes the REJECT moderation_log row.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { requireAdmin } from '@/lib/auth/verify-auth'
import { rejectSchema } from '@/lib/validation/admin'
import * as moderationService from '@/lib/services/moderation-service'

export const POST = withRoute(async (req, ctxParams) => {
  const ctx = await requireAdmin(req)
  const { id } = await ctxParams.params
  const { reason, detail, expectedUpdatedAt } = await parseJsonBody(req, rejectSchema)
  const listing = await moderationService.reject(ctx, id, reason, detail, expectedUpdatedAt)
  return Response.json(listing)
})
