// Prisma client singleton for serverless — docs/09-backend/README.md §6.1.
// Prisma 7: the runtime client connects through a driver adapter on the POOLED
// Neon URL (DATABASE_URL, doc 07 §8.3); migrations/CLI use DIRECT_URL via
// prisma.config.ts. The singleton survives dev hot-reloads and is reused across
// warm serverless invocations.

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set (see .env.example and docs/13 §2.3)')
  }
  const adapter = new PrismaPg(connectionString)
  return new PrismaClient({ adapter, log: ['warn', 'error'] })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
