// API-16 — POST /listings/{id}/images (doc 08 §2): attach an uploaded R2 object
// to the listing (prefix check, magic-bytes re-check, WebP variant generation,
// ≤5 cap). Owner only.

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
  try {
    const image = await imageService.attachImage(authCtx, id, input)
    return Response.json(image, { status: 201 })
  } catch (e) {
    // TEMP DIAGNOSTIC (remove after) — surface the real attach failure that the
    // generic INTERNAL envelope hides, so the prod upload bug can be pinpointed.
    const err = e as { name?: string; message?: string; code?: string; $metadata?: unknown; stack?: string }
    return Response.json(
      {
        __diag: {
          name: err?.name ?? null,
          message: String(err?.message ?? e).slice(0, 400),
          code: err?.code ?? null,
          meta: err?.$metadata ?? null,
          stack: String(err?.stack ?? '').split('\n').slice(0, 5),
        },
      },
      { status: 599 },
    )
  }
})
