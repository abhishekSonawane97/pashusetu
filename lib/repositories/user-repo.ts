// User repository — Prisma queries only (doc 09 §2 layering). findByFirebaseUid
// is the hottest lookup in the system (every authenticated request, doc 07 §4.2
// unique index on firebase_uid).

import type { District, LanguagePref, User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { UpdateUserInput } from '@/lib/validation/users'

export type UserWithDistrict = User & { district: District | null }

export async function findByFirebaseUid(firebaseUid: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { firebaseUid } })
}

/**
 * Lookup by E.164 phone (unique). Used only by the OTP verify path to reuse a
 * returning user's existing firebaseUid when minting their custom token, so they
 * map back to their row regardless of how that uid was originally assigned.
 */
export async function findByPhone(phone: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { phone } })
}

export async function findMeByFirebaseUid(firebaseUid: string): Promise<UserWithDistrict | null> {
  return prisma.user.findUnique({ where: { firebaseUid }, include: { district: true } })
}

export async function createUser(data: {
  firebaseUid: string
  phone: string
  name: string
  districtId: string
  taluka: string | null
  village: string | null
  isFarmer: boolean
  isBuyer: boolean
  languagePref: LanguagePref
}): Promise<UserWithDistrict> {
  return prisma.user.create({ data, include: { district: true } })
}

export async function updateUser(id: string, data: UpdateUserInput): Promise<UserWithDistrict> {
  return prisma.user.update({ where: { id }, data, include: { district: true } })
}
