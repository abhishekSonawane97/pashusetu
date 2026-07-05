// API-07 — GET /listings/{id} (doc 08 §2.3): listing detail. Public for
// APPROVED; owner/admin see any status with the extended field set. optionalAuth
// so the viewer block + owner extension work when a token is present, and the
// endpoint never 401s for the public.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { optionalAuth, requireProfile, verifyAuth } from '@/lib/auth/verify-auth'
import { updateListingSchema } from '@/lib/validation/listings'
import * as listingService from '@/lib/services/listing-service'

export const dynamic = 'force-dynamic' // view-count increments on every fetch

// API-07 — public listing detail.
export const GET = withRoute(async (req, ctx) => {
  const { id } = await ctx.params
  const viewer = await optionalAuth(req)
  const detail = await listingService.getDetail(id, viewer)
  return Response.json(detail)
})

// API-09 — partial edit (owner). Server computes the changed set + status rules.
export const PATCH = withRoute(async (req, ctx) => {
  const authCtx = await verifyAuth(req)
  requireProfile(authCtx)
  const { id } = await ctx.params
  const input = await parseJsonBody(req, updateListingSchema)
  const detail = await listingService.editListing(authCtx, id, input)
  return Response.json(detail)
})
