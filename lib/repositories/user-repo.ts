// User repository — Prisma queries only (doc 09 §2 layering). findByFirebaseUid
// is the hottest lookup in the system (every authenticated request, doc 07 §4.2
// unique index on firebase_uid).

import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function findByFirebaseUid(firebaseUid: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { firebaseUid } })
}
