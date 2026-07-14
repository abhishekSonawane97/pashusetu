// GET /admin/feedback (NFR-10) — the feedback inbox. Admin-only. Returns the most
// recent items (optionally filtered by status) plus the count of unhandled (NEW).

import { withRoute } from '@/lib/errors/handle'
import { parseQuery } from '@/lib/api/parse'
import { requireAdmin } from '@/lib/auth/verify-auth'
import { adminFeedbackQuerySchema } from '@/lib/validation/feedback'
import * as feedbackService from '@/lib/services/feedback-service'

export const GET = withRoute(async (req) => {
  await requireAdmin(req)
  const { status } = parseQuery(req, adminFeedbackQuerySchema)
  return Response.json(await feedbackService.list({ status }))
})
