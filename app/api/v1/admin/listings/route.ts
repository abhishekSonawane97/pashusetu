// API-25 — GET /admin/listings?status= (doc 08 §admin): moderation queue +
// status browser. Admin only (BR-012); non-admins get 403 with no data leakage.

import { withRoute } from '@/lib/errors/handle'
import { parseQuery } from '@/lib/api/parse'
import { requireAdmin } from '@/lib/auth/verify-auth'
import { adminListQuerySchema } from '@/lib/validation/admin'
import * as moderationService from '@/lib/services/moderation-service'

export const GET = withRoute(async (req) => {
  await requireAdmin(req)
  const { status, cursor, limit } = parseQuery(req, adminListQuerySchema)
  const page = await moderationService.listQueue(status, cursor, limit)
  return Response.json(page)
})
