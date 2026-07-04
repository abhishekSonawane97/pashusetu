// User schemas — doc 08 API-01/API-03 request tables 1:1 (doc 09 §4.1).
// phone and firebaseUid come from verified token claims only — they do not
// exist in any client-writable schema (mass-assignment guard, doc 12 §8.2).

import { z } from 'zod'
import { containsPhoneNumber } from './common'

// API-01: emoji stripped server-side, then 2–50 chars, ≥2 letter characters.
const nameSchema = z
  .string()
  .transform((s) => s.replace(/\p{Extended_Pictographic}/gu, '').trim())
  .transform((s) => s.normalize('NFC'))
  .refine((s) => [...s].length >= 2 && [...s].length <= 50, '2–50 characters required')
  .refine((s) => (s.match(/\p{L}/gu) ?? []).length >= 2, 'at least 2 letters required')
  .superRefine((s, ctx) => {
    if (containsPhoneNumber(s)) {
      ctx.addIssue({ code: 'custom', message: 'phone number not allowed in name' })
    }
  })

const talukaSchema = z
  .string()
  .trim()
  .transform((s) => s.normalize('NFC'))
  .refine((s) => [...s].length <= 60, 'too long (max 60 characters)')
  .superRefine((s, ctx) => {
    if (containsPhoneNumber(s)) {
      ctx.addIssue({ code: 'custom', message: 'phone number not allowed in taluka' })
    }
  })

const villageSchema = z
  .string()
  .trim()
  .transform((s) => s.normalize('NFC'))
  .refine((s) => [...s].length >= 2 && [...s].length <= 60, '2–60 characters required')
  .superRefine((s, ctx) => {
    if (containsPhoneNumber(s)) {
      ctx.addIssue({ code: 'custom', message: 'phone number not allowed in village' })
    }
  })

const languagePrefSchema = z.enum(['MR', 'EN'])

const roleFlagsRule = (
  data: { isFarmer?: boolean; isBuyer?: boolean },
  ctx: z.RefinementCtx,
  current?: { isFarmer: boolean; isBuyer: boolean },
) => {
  const isFarmer = data.isFarmer ?? current?.isFarmer ?? true
  const isBuyer = data.isBuyer ?? current?.isBuyer ?? true
  if (!isFarmer && !isBuyer) {
    ctx.addIssue({ code: 'custom', path: ['isBuyer'], message: 'at least one role must be true' })
  }
}

// API-01 — POST /users
export const createUserSchema = z
  .object({
    name: nameSchema,
    districtId: z.string().min(1), // existence against seeded districts enforced by FK (P2003 → 422)
    taluka: talukaSchema.optional(),
    village: villageSchema.optional(),
    isFarmer: z.boolean().default(true), // BR-011
    isBuyer: z.boolean().default(true),
    languagePref: languagePrefSchema.default('MR'), // BR-010
  })
  .strict()
  .superRefine((data, ctx) => roleFlagsRule(data, ctx))

export type CreateUserInput = z.infer<typeof createUserSchema>

// API-03 — PATCH /users/me: all optional, same validations; `phone` and any
// unknown key are rejected by .strict() → 400 VALIDATION_ERROR.
export const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    districtId: z.string().min(1).optional(),
    taluka: talukaSchema.nullable().optional(),
    village: villageSchema.nullable().optional(),
    isFarmer: z.boolean().optional(),
    isBuyer: z.boolean().optional(),
    languagePref: languagePrefSchema.optional(),
  })
  .strict()

export type UpdateUserInput = z.infer<typeof updateUserSchema>
