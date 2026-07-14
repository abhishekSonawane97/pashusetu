// GET /admin/stats (NFR-10) — the admin analytics snapshot. Admin-only.

import { withRoute } from '@/lib/errors/handle'
import { requireAdmin } from '@/lib/auth/verify-auth'
import * as statsService from '@/lib/services/stats-service'

export const GET = withRoute(async (req) => {
  await requireAdmin(req)
  const stats = await statsService.getStats()
  return Response.json(stats)
})
