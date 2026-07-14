// PATCH /admin/feedback/[id] (NFR-10) — advance a feedback item's status
// (NEW → SEEN → DONE), so the inbox is a workable triage queue. Admin-only.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { requireAdmin } from '@/lib/auth/verify-auth'
import { updateFeedbackStatusSchema } from '@/lib/validation/feedback'
import * as feedbackService from '@/lib/services/feedback-service'

export const PATCH = withRoute(async (req, ctx) => {
  await requireAdmin(req)
  const { id } = await ctx.params
  const { status } = await parseJsonBody(req, updateFeedbackStatusSchema)
  return Response.json(await feedbackService.setStatus(id, status))
})
