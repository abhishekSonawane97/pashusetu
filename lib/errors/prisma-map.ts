// Prisma → AppError mapping — docs/09-backend/README.md §5.3.
// Duck-typed on the P-code shape so this module never imports the generated
// client (it works before `prisma generate` and in unit tests). Repos prefer
// updateMany CAS + null returns; this table is the backstop.

import { AppError } from './app-error'

type PrismaLikeError = { code: string; meta?: { target?: unknown } }

function asPrismaError(e: unknown): PrismaLikeError | null {
  const code = (e as PrismaLikeError | null)?.code
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? (e as PrismaLikeError) : null
}

/** Returns the mapped AppError, or null when `e` is not a Prisma known error. */
export function mapPrismaError(e: unknown): AppError | null {
  const err = asPrismaError(e)
  if (!err) return null

  switch (err.code) {
    case 'P2002': {
      // Unique violation — refined by constraint target (doc 09 §5.3).
      // favorites-PK idempotent success is handled in the repo, never here.
      const target = String(
        Array.isArray(err.meta?.target)
          ? (err.meta.target as unknown[]).join(',')
          : (err.meta?.target ?? ''),
      )
      if (target.includes('phone') || target.includes('firebase_uid')) {
        return AppError.userAlreadyExists()
      }
      if (target.includes('report')) {
        return AppError.reportAlreadyExists()
      }
      return AppError.conflict()
    }
    case 'P2025':
      return AppError.notFound()
    case 'P2003':
      // FK violation — reference data is seed-only, so this is bad client input.
      return AppError.validation({ reference: 'unknown reference id' })
    case 'P2034': // transaction conflict — caller retries once (doc 09 §5.3); backstop:
    case 'P2024': // pool timeout — capacity signal
    case 'P1001':
    case 'P1002':
    case 'P1008':
    default:
      return AppError.internal()
  }
}
