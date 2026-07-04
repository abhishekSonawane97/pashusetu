// User service — business rules for F-01/F-02 (doc 08 API-01/02/03).
// Identity (firebaseUid, phone) comes exclusively from verified token claims
// (doc 12 §3.1); the resulting flag pair must keep at least one role true (BR-011).

import type { District, User } from '@prisma/client'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { AppError } from '@/lib/errors/app-error'
import type { AuthContext } from '@/lib/auth/auth-context'
import type { CreateUserInput, UpdateUserInput } from '@/lib/validation/users'
import * as userRepo from '@/lib/repositories/user-repo'

type UserWithDistrict = User & { district: District | null }

/** doc 08 §1.9 UserProfile — firebaseUid never returned; phone only to self/admin. */
export function toUserProfile(user: UserWithDistrict) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    isFarmer: user.isFarmer,
    isBuyer: user.isBuyer,
    isAdmin: user.isAdmin,
    districtId: user.districtId,
    district: user.district
      ? {
          id: user.district.id,
          nameEn: user.district.nameEn,
          nameMr: user.district.nameMr,
          state: user.district.state,
        }
      : null,
    taluka: user.taluka,
    village: user.village,
    languagePref: user.languagePref,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

/** API-01: create profile row after first Firebase login (BR-010). */
export async function createUser(token: DecodedIdToken, input: CreateUserInput) {
  const phone = token.phone_number
  if (!phone) throw AppError.unauthenticated() // phone-OTP tokens always carry phone_number

  // P2002 on firebase_uid/phone → USER_ALREADY_EXISTS via the doc 09 §5.3 map.
  const user = await userRepo.createUser({
    firebaseUid: token.uid,
    phone,
    name: input.name,
    districtId: input.districtId,
    taluka: input.taluka ?? null,
    village: input.village ?? null,
    isFarmer: input.isFarmer,
    isBuyer: input.isBuyer,
    languagePref: input.languagePref,
  })
  return toUserProfile(user)
}

/** API-03: edit own profile; phone immutable (schema-level); BR-011 on the resulting pair. */
export async function updateUser(ctx: AuthContext, input: UpdateUserInput) {
  const isFarmer = input.isFarmer ?? ctx.user.isFarmer
  const isBuyer = input.isBuyer ?? ctx.user.isBuyer
  if (!isFarmer && !isBuyer) {
    throw AppError.validation({ isBuyer: 'at least one role must be true' })
  }
  const user = await userRepo.updateUser(ctx.user.id, input)
  return toUserProfile(user)
}
