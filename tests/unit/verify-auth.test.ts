// PS-010 acceptance (doc 15): 401 UNAUTHENTICATED / 403 USER_BANNED exact;
// bans bite on the very next request via the per-request DB status read
// (doc 09 §3.1–3.2, doc 12 §3). firebase-admin and the user repo are mocked —
// the real integration runs on a Neon branch with Firebase test tokens (PS-003+).
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/firebase-admin', () => ({
  getAdminAuth: vi.fn(),
}))
vi.mock('@/lib/repositories/user-repo', () => ({
  findByFirebaseUid: vi.fn(),
}))

import { getAdminAuth } from '@/lib/auth/firebase-admin'
import * as userRepo from '@/lib/repositories/user-repo'
import {
  assertOwnerVisible,
  optionalAuth,
  requireAdmin,
  requireProfile,
  verifyAuth,
} from '@/lib/auth/verify-auth'
import type { User } from '@prisma/client'

const mockVerifyIdToken = vi.fn()
vi.mocked(getAdminAuth).mockReturnValue({
  verifyIdToken: mockVerifyIdToken,
} as unknown as ReturnType<typeof getAdminAuth>)

const activeUser = {
  id: 'cuser000000000000000001',
  firebaseUid: 'fb-uid-1',
  phone: '+919876543210',
  name: 'रमेश पाटील',
  isFarmer: true,
  isBuyer: true,
  isAdmin: false,
  districtId: 'cdist000000000000000001',
  status: 'ACTIVE',
} as unknown as User

const req = (token?: string) =>
  new Request('http://test.local/api/v1/x', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

beforeEach(() => {
  vi.mocked(userRepo.findByFirebaseUid).mockReset()
  mockVerifyIdToken.mockReset()
  mockVerifyIdToken.mockResolvedValue({ uid: 'fb-uid-1', phone_number: '+919876543210' })
})

describe('verifyAuth (doc 09 §3.1)', () => {
  it('missing Authorization header → 401 UNAUTHENTICATED', async () => {
    await expect(verifyAuth(req())).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      httpStatus: 401,
    })
  })

  it('malformed header (no Bearer) → 401', async () => {
    const r = new Request('http://test.local/x', { headers: { authorization: 'Token abc' } })
    await expect(verifyAuth(r)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('Firebase verification failure → 401, never leaks the SDK error', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('aud mismatch'))
    await expect(verifyAuth(req('bad'))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('verified token but no users row → 403 PROFILE_INCOMPLETE by default', async () => {
    vi.mocked(userRepo.findByFirebaseUid).mockResolvedValue(null)
    await expect(verifyAuth(req('t'))).rejects.toMatchObject({
      code: 'PROFILE_INCOMPLETE',
      httpStatus: 403,
    })
  })

  it("onMissingUser: 'NOT_FOUND' → 404 (GET /users/me routes to S-04)", async () => {
    vi.mocked(userRepo.findByFirebaseUid).mockResolvedValue(null)
    await expect(verifyAuth(req('t'), { onMissingUser: 'NOT_FOUND' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    })
  })

  it('BANNED user → 403 USER_BANNED on the very next request (BR-014)', async () => {
    vi.mocked(userRepo.findByFirebaseUid).mockResolvedValue({
      ...activeUser,
      status: 'BANNED',
    } as User)
    await expect(verifyAuth(req('t'))).rejects.toMatchObject({
      code: 'USER_BANNED',
      httpStatus: 403,
    })
  })

  it('allowBanned bypass (only GET /users/me) returns the row for the banned screen', async () => {
    vi.mocked(userRepo.findByFirebaseUid).mockResolvedValue({
      ...activeUser,
      status: 'BANNED',
    } as User)
    const ctx = await verifyAuth(req('t'), { allowBanned: true })
    expect(ctx.user.status).toBe('BANNED')
  })

  it('happy path attaches the full user row', async () => {
    vi.mocked(userRepo.findByFirebaseUid).mockResolvedValue(activeUser)
    const ctx = await verifyAuth(req('t'))
    expect(ctx.user.id).toBe(activeUser.id)
    expect(vi.mocked(userRepo.findByFirebaseUid)).toHaveBeenCalledWith('fb-uid-1')
  })
})

describe('guards', () => {
  it('requireProfile: missing district → 403 PROFILE_INCOMPLETE (BR-013)', () => {
    expect(() => requireProfile({ user: { ...activeUser, districtId: null } as User })).toThrow(
      expect.objectContaining({ code: 'PROFILE_INCOMPLETE' }),
    )
    expect(() => requireProfile({ user: activeUser })).not.toThrow()
  })

  it('requireAdmin: non-admin → plain 403 FORBIDDEN, no data leakage (SEC-T04)', async () => {
    vi.mocked(userRepo.findByFirebaseUid).mockResolvedValue(activeUser)
    await expect(requireAdmin(req('t'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
      httpStatus: 403,
    })
    vi.mocked(userRepo.findByFirebaseUid).mockResolvedValue({
      ...activeUser,
      isAdmin: true,
    } as User)
    await expect(requireAdmin(req('t'))).resolves.toMatchObject({ user: { isAdmin: true } })
  })

  it('optionalAuth: absent or invalid token → null, never 401', async () => {
    await expect(optionalAuth(req())).resolves.toBeNull()
    mockVerifyIdToken.mockRejectedValue(new Error('expired'))
    await expect(optionalAuth(req('expired'))).resolves.toBeNull()
  })
})

describe('assertOwnerVisible (doc 09 §3.5 masking)', () => {
  const ctx = { user: activeUser }

  it('missing listing → 404 LISTING_NOT_FOUND', () => {
    expect(() => assertOwnerVisible(ctx, null)).toThrow(
      expect.objectContaining({ code: 'LISTING_NOT_FOUND' }),
    )
  })

  it('owner always passes regardless of status', () => {
    expect(() =>
      assertOwnerVisible(ctx, { sellerId: activeUser.id, status: 'DRAFT' }),
    ).not.toThrow()
  })

  it('non-owner on APPROVED → 403 FORBIDDEN (publicly visible anyway)', () => {
    expect(() => assertOwnerVisible(ctx, { sellerId: 'other', status: 'APPROVED' })).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    )
  })

  it('non-owner on hidden statuses → 404, existence never confirmed', () => {
    for (const status of ['DRAFT', 'PENDING', 'REJECTED', 'EXPIRED', 'ARCHIVED', 'SOLD']) {
      expect(() => assertOwnerVisible(ctx, { sellerId: 'other', status })).toThrow(
        expect.objectContaining({ code: 'LISTING_NOT_FOUND' }),
      )
    }
  })
})
