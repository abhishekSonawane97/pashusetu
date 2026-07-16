// API-16 — POST /listings/{id}/images (doc 08 §2): attach an uploaded R2 object
// to the listing (prefix check, magic-bytes re-check, WebP variant generation,
// photo-count cap). Owner only.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { requireProfile, verifyAuth } from '@/lib/auth/verify-auth'
import { attachImageSchema } from '@/lib/validation/images'
import * as imageService from '@/lib/services/image-service'

export const POST = withRoute(async (req, ctx) => {
  const authCtx = await verifyAuth(req)
  requireProfile(authCtx)
  const { id } = await ctx.params
  const input = await parseJsonBody(req, attachImageSchema)
  const image = await imageService.attachImage(authCtx, id, input)
  return Response.json(image, { status: 201 })
})
