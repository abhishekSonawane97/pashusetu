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
  try {
    const image = await imageService.attachImage(authCtx, id, input)
    return Response.json(image, { status: 201 })
  } catch (e) {
    // TEMP DIAGNOSTIC (remove after) — reveal the real attach failure (name, AWS
    // error code, $metadata op context) both in the response and Vercel logs.
    const err = e as {
      name?: string
      message?: string
      code?: string
      Code?: string
      $metadata?: unknown
      stack?: string
    }
    console.error(
      'ATTACH_FAIL',
      err?.name,
      err?.message,
      err?.code || err?.Code,
      JSON.stringify(err?.$metadata),
    )
    return Response.json(
      {
        __diag: {
          name: err?.name ?? null,
          message: String(err?.message ?? e).slice(0, 500),
          code: (err?.code || err?.Code) ?? null,
          meta: err?.$metadata ?? null,
          stack: String(err?.stack ?? '').split('\n').slice(0, 6),
        },
      },
      { status: 599 },
    )
  }
})
