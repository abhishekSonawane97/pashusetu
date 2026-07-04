// API-02 — GET /users/me: own profile; works even when BANNED (the single
// BR-014 exception); 404 = "authed but no profile" → client routes to S-04.
// API-03 — PATCH /users/me: edit profile; phone immutable.
// Contracts: docs/08-api/README.md §2.1.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { verifyAuth, verifyToken } from '@/lib/auth/verify-auth'
import { AppError } from '@/lib/errors/app-error'
import { updateUserSchema } from '@/lib/validation/users'
import * as userRepo from '@/lib/repositories/user-repo'
import * as userService from '@/lib/services/user-service'

export const GET = withRoute(async (req) => {
  const token = await verifyToken(req)
  const user = await userRepo.findMeByFirebaseUid(token.uid)
  if (!user) throw AppError.notFound() // expected on first login — routes to S-04
  return Response.json(userService.toUserProfile(user))
})

export const PATCH = withRoute(async (req) => {
  const ctx = await verifyAuth(req) // banned users cannot edit (BR-014)
  const input = await parseJsonBody(req, updateUserSchema)
  const profile = await userService.updateUser(ctx, input)
  return Response.json(profile)
})
