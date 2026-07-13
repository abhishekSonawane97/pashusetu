// Shared zod refinements — docs/09-backend/README.md §4.2, values owned by
// docs/04-business-rules/README.md (BR ids cited per line). Every schema that
// composes these is .strict(); domain schemas mirror doc 08's request tables 1:1.

import { z } from 'zod'

// BR-010 — Indian mobile E.164. Defensive only: identity phone always comes
// from Firebase token claims, never a request body.
export const e164Phone = z.string().regex(/^\+91[6-9]\d{9}$/, 'invalid Indian mobile number')

// BR-026 — asking price bounds (integer INR).
export const priceInr = z
  .number()
  .int()
  .min(500, 'below minimum price')
  .max(1_000_000, 'above maximum price')

/**
 * BR-065 hard block: normalize Devanagari digits to ASCII, collapse separators
 * inside digit runs, then reject anything that looks like a phone number
 * (Indian mobile pattern or any run of 10+ digits).
 */
export function containsPhoneNumber(text: string): boolean {
  const normalized = text
    .replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
    .replace(/(\d)[\s\-.]+(?=\d)/g, '$1')
  return /(\+?91)?[6-9]\d{9}/.test(normalized) || /\d{10,}/.test(normalized)
}

const noPhone = (field: string) => (value: string, ctx: z.RefinementCtx) => {
  if (containsPhoneNumber(value)) {
    ctx.addIssue({ code: 'custom', message: `phone number not allowed in ${field}` })
  }
}

// BR-025 — description: trim, NFC, 10–1000 Unicode code points, no phone numbers.
export const description = z
  .string()
  .trim()
  .transform((s) => s.normalize('NFC'))
  .refine((s) => [...s].length >= 10, 'too short (min 10 characters)')
  .refine((s) => [...s].length <= 1000, 'too long (max 1000 characters)')
  .superRefine(noPhone('description'))

// BR-065 also applies to free-text location/name fields.
export const shortText = (field: string, max = 100) =>
  z
    .string()
    .trim()
    .transform((s) => s.normalize('NFC'))
    .refine((s) => [...s].length >= 1, 'required')
    .refine((s) => [...s].length <= max, `too long (max ${max} characters)`)
    .superRefine(noPhone(field))

// BR-090 #12 — cursor pagination: default 20, min 1, max 50 (>50 → 422).
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// doc 08 §1.6 — path ids are cuids.
export const cuidSchema = z.string().regex(/^c[a-z0-9]{20,}$/, 'invalid id')

// Enum schemas — exact doc 07 values (BR-022, BR-050, BR-062).
export const speciesSchema = z.enum(['COW', 'BUFFALO', 'BULL_OX', 'GOAT', 'SHEEP', 'REDA'])
export const sexSchema = z.enum(['FEMALE', 'MALE'])
export const interestTypeSchema = z.enum(['CALL', 'WHATSAPP', 'INTEREST'])
export const reportReasonSchema = z.enum([
  'FAKE',
  'SOLD_ALREADY',
  'WRONG_INFO',
  'SPAM',
  'ILLEGAL',
  'OTHER',
])
export const listingStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'SOLD',
  'REJECTED',
  'EXPIRED',
  'ARCHIVED',
])

export type Species = z.infer<typeof speciesSchema>
export type Sex = z.infer<typeof sexSchema>
export type InterestType = z.infer<typeof interestTypeSchema>
export type ReportReason = z.infer<typeof reportReasonSchema>
export type ListingStatus = z.infer<typeof listingStatusSchema>
