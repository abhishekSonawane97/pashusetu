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
