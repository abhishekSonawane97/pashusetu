// API-15 — POST /uploads/presign (doc 08 §2): issue a presigned PUT for one
// photo, validating content-type + size before any byte is uploaded. Owner only.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { requireProfile, verifyAuth } from '@/lib/auth/verify-auth'
import { presignSchema } from '@/lib/validation/images'
import * as imageService from '@/lib/services/image-service'

export const POST = withRoute(async (req) => {
  const ctx = await verifyAuth(req)
  requireProfile(ctx)
  const input = await parseJsonBody(req, presignSchema)
  const result = await imageService.presign(ctx, input)
  return Response.json(result)
})
