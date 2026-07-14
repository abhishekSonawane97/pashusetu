// POST /feedback (NFR-10) — app feedback / problem reports. Public: a signed-out
// visitor can submit (optionalAuth attaches userId only when a token is present, and
// never 401s). No listing link — this is about the app, not one ad.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { optionalAuth } from '@/lib/auth/verify-auth'
import { createFeedbackSchema } from '@/lib/validation/feedback'
import * as feedbackService from '@/lib/services/feedback-service'

export const POST = withRoute(async (req) => {
  const ctx = await optionalAuth(req)
  const input = await parseJsonBody(req, createFeedbackSchema)
  const result = await feedbackService.submit(ctx, input)
  return Response.json(result, { status: 201 })
})
