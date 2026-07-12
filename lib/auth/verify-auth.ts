// Authentication middleware — docs/09-backend/README.md §3.1–§3.2, implementing
// docs/12-security/README.md §3 exactly. No route may hand-roll verification.
//
// Verify on every request; cache nothing per-user. The Admin SDK verifies the
// JWT locally against Google's cached public certs (CPU-only). checkRevoked
// stays false by design: the per-request DB status lookup below is the
// faster-acting ban gate (doc 12 §3.3); Firebase-level revocation is the
// recorded Phase 2 hardening item.

import type { DecodedIdToken } from 'firebase-admin/auth'
import { AppError } from '@/lib/errors/app-error'
import { getAdminAuth } from './firebase-admin'
import type { AuthContext } from './auth-context'
import * as userRepo from '@/lib/repositories/user-repo'

export type VerifyAuthOptions = {
  /** Only GET /users/me: lets a banned user fetch their own row to render the banned screen (BR-014). */
  allowBanned?: boolean
  /**
   * What a verified token WITHOUT a users row means to this endpoint (doc 09 §3.1 step 3):
   * - 'PROFILE_INCOMPLETE' (default) → 403, client routes to profile setup
   * - 'NOT_FOUND'                    → 404, used by GET /users/me (routes to S-04)
   */
  onMissingUser?: 'PROFILE_INCOMPLETE' | 'NOT_FOUND'
}

/** Step 1+2: header extraction and Firebase signature verification (401 on any failure). */
export async function verifyToken(req: Request): Promise<DecodedIdToken> {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) throw AppError.unauthenticated()
  try {
    const auth = await getAdminAuth()
    return await auth.verifyIdToken(match[1])
  } catch {
    throw AppError.unauthenticated()
  }
}

export async function verifyAuth(req: Request, opts: VerifyAuthOptions = {}): Promise<AuthContext> {
  const decoded = await verifyToken(req)

  // The decoded uid is the ONLY identity input — body/query can never influence identity.
  const user = await userRepo.findByFirebaseUid(decoded.uid)
  if (!user) {
    throw opts.onMissingUser === 'NOT_FOUND' ? AppError.notFound() : AppError.profileIncomplete()
  }

  if (user.status === 'BANNED' && !opts.allowBanned) {
    throw AppError.userBanned()
  }

  return { user }
}

/** BR-013: name and district must be set before any authenticated write. */
export function requireProfile(ctx: AuthContext): void {
  if (!ctx.user.name?.trim() || !ctx.user.districtId) {
    throw AppError.profileIncomplete()
  }
}

/**
 * Admin gate (SEC-T04/BR-012): row-level isAdmin re-read per request — no cached
 * flag, no data leakage (plain FORBIDDEN). Used by every /api/v1/admin/** handler
 * and by app/admin/layout.tsx server-side.
 */
export async function requireAdmin(req: Request): Promise<AuthContext> {
  const ctx = await verifyAuth(req)
  if (!ctx.user.isAdmin) throw AppError.forbidden()
  return ctx
}

/** For public endpoints that personalize when a token is present: never 401s. */
export async function optionalAuth(req: Request): Promise<AuthContext | null> {
  try {
    return await verifyAuth(req)
  } catch {
    return null
  }
}

/**
 * Ownership masking (doc 09 §3.5 / doc 12 §4): existence of hidden listings is
 * never confirmed to non-owners. Ownership is checked BEFORE state guards so
 * error codes never leak state.
 */
export function assertOwnerVisible(
  ctx: AuthContext,
  listing: { sellerId: string; status: string } | null,
): void {
  if (!listing) throw AppError.listingNotFound()
  if (listing.sellerId === ctx.user.id) return
  if (listing.status === 'APPROVED') throw AppError.forbidden() // publicly visible anyway
  throw AppError.listingNotFound() // hidden statuses: existence never confirmed
}
