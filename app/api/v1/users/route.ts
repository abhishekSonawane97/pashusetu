// API-01 — POST /users (docs/08-api/README.md §2.1): create the local profile
// row after the first Firebase login. Identity from token claims only.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { verifyToken } from '@/lib/auth/verify-auth'
import { createUserSchema } from '@/lib/validation/users'
import * as userService from '@/lib/services/user-service'

export const POST = withRoute(async (req) => {
  const token = await verifyToken(req) // no profile row required — this creates it
  const input = await parseJsonBody(req, createUserSchema)
  const profile = await userService.createUser(token, input)
  return Response.json(profile, { status: 201 })
})
