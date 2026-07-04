// PS-011/PS-012 (code-level): API-01/03 schema rules and service behavior —
// identity from token claims only, BR-011 role-pair rule, BR-013/BR-065 name
// rules, UserProfile serialization (no firebaseUid on the wire).
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repositories/user-repo', () => ({
  findByFirebaseUid: vi.fn(),
  findMeByFirebaseUid: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}))

import type { DecodedIdToken } from 'firebase-admin/auth'
import * as userRepo from '@/lib/repositories/user-repo'
import { createUser, toUserProfile, updateUser } from '@/lib/services/user-service'
import { createUserSchema, updateUserSchema } from '@/lib/validation/users'

const dbUser = {
  id: 'cuser000000000000000001',
  firebaseUid: 'fb-1',
  phone: '+919876543210',
  name: 'रमेश पाटील',
  isFarmer: true,
  isBuyer: true,
  isAdmin: false,
  districtId: 'cdist00000000000000001',
  taluka: 'कोरेगाव',
  village: 'निगडी',
  languagePref: 'MR',
  status: 'ACTIVE',
  createdAt: new Date('2026-07-05T00:00:00.000Z'),
  updatedAt: new Date('2026-07-05T00:00:00.000Z'),
  district: {
    id: 'cdist00000000000000001',
    nameEn: 'Satara',
    nameMr: 'सातारा',
    state: 'MH',
    createdAt: new Date(),
  },
} as unknown as Parameters<typeof toUserProfile>[0]

beforeEach(() => {
  vi.mocked(userRepo.createUser).mockReset().mockResolvedValue(dbUser)
  vi.mocked(userRepo.updateUser).mockReset().mockResolvedValue(dbUser)
})

describe('createUserSchema (API-01)', () => {
  const valid = { name: 'रमेश पाटील', districtId: 'cdist00000000000000001' }

  it('accepts a minimal valid body and applies defaults (BR-010/011)', () => {
    const parsed = createUserSchema.parse(valid)
    expect(parsed.isFarmer).toBe(true)
    expect(parsed.isBuyer).toBe(true)
    expect(parsed.languagePref).toBe('MR')
  })

  it('strips emoji from name, then validates length', () => {
    const parsed = createUserSchema.parse({ ...valid, name: '🐄🐄 रमेश 🐄' })
    expect(parsed.name).toBe('रमेश')
  })

  it('rejects digit-only and phone-bearing names', () => {
    expect(createUserSchema.safeParse({ ...valid, name: '12345' }).success).toBe(false)
    expect(createUserSchema.safeParse({ ...valid, name: 'रमेश 9876543210' }).success).toBe(false)
  })

  it('rejects both role flags false (422 rule)', () => {
    expect(createUserSchema.safeParse({ ...valid, isFarmer: false, isBuyer: false }).success).toBe(
      false,
    )
  })

  it('rejects unknown keys — phone can never come from the body (mass-assignment guard)', () => {
    expect(createUserSchema.safeParse({ ...valid, phone: '+919999999999' }).success).toBe(false)
    expect(createUserSchema.safeParse({ ...valid, isAdmin: true }).success).toBe(false)
  })
})

describe('updateUserSchema (API-03)', () => {
  it('all fields optional; unknown keys rejected', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true)
    expect(updateUserSchema.safeParse({ village: 'निगडी' }).success).toBe(true)
    expect(updateUserSchema.safeParse({ phone: '+919999999999' }).success).toBe(false)
  })
})

describe('user service', () => {
  it('createUser takes identity exclusively from token claims', async () => {
    const token = { uid: 'fb-1', phone_number: '+919876543210' } as DecodedIdToken
    await createUser(token, createUserSchema.parse({ name: 'रमेश पाटील', districtId: 'd1' }))
    expect(vi.mocked(userRepo.createUser)).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: 'fb-1', phone: '+919876543210' }),
    )
  })

  it('updateUser enforces BR-011 against the CURRENT flag pair', async () => {
    const ctx = { user: { ...dbUser, isFarmer: false, isBuyer: true } } as never
    await expect(updateUser(ctx, { isBuyer: false })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      httpStatus: 422,
    })
  })

  it('toUserProfile never exposes firebaseUid and serializes district + ISO dates', () => {
    const profile = toUserProfile(dbUser)
    expect(profile).not.toHaveProperty('firebaseUid')
    expect(profile.district).toEqual({
      id: 'cdist00000000000000001',
      nameEn: 'Satara',
      nameMr: 'सातारा',
      state: 'MH',
    })
    expect(profile.createdAt).toBe('2026-07-05T00:00:00.000Z')
  })
})
