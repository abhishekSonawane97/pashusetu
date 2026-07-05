// API-07 — GET /listings/{id} (doc 08 §2.3): listing detail. Public for
// APPROVED; owner/admin see any status with the extended field set. optionalAuth
// so the viewer block + owner extension work when a token is present, and the
// endpoint never 401s for the public.

import { withRoute } from '@/lib/errors/handle'
import { optionalAuth } from '@/lib/auth/verify-auth'
import * as listingService from '@/lib/services/listing-service'

export const dynamic = 'force-dynamic' // view-count increments on every fetch

export const GET = withRoute(async (req, ctx) => {
  const { id } = await ctx.params
  const viewer = await optionalAuth(req)
  const detail = await listingService.getDetail(id, viewer)
  return Response.json(detail)
})
