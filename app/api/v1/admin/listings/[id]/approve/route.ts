// API-26 — POST /admin/listings/{id}/approve (T-03 PENDING→APPROVED, S-20).
// Admin only. Optimistic-review guard via expectedUpdatedAt; one transaction
// sets status/approvedAt/expiresAt and writes the APPROVE moderation_log row.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { requireAdmin } from '@/lib/auth/verify-auth'
import { approveSchema } from '@/lib/validation/admin'
import * as moderationService from '@/lib/services/moderation-service'

export const POST = withRoute(async (req, ctxParams) => {
  const ctx = await requireAdmin(req)
  const { id } = await ctxParams.params
  const { expectedUpdatedAt } = await parseJsonBody(req, approveSchema)
  const listing = await moderationService.approve(ctx, id, expectedUpdatedAt)
  return Response.json(listing)
})
