// API-17 — DELETE /listings/{id}/images/{imageId} (doc 08 §2): remove a photo
// (owner). Deletes the row, then best-effort R2 cleanup of original + variants.

import { withRoute } from '@/lib/errors/handle'
import { requireProfile, verifyAuth } from '@/lib/auth/verify-auth'
import * as imageService from '@/lib/services/image-service'

export const DELETE = withRoute(async (req, ctx) => {
  const authCtx = await verifyAuth(req)
  requireProfile(authCtx)
  const { id, imageId } = await ctx.params
  await imageService.deleteImage(authCtx, id, imageId)
  return new Response(null, { status: 204 })
})
