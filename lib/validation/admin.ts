// Admin moderation validation — docs/08-api/README.md API-25/26/27, values owned
// by docs/04-business-rules/README.md (BR-012 admin gate, BR-040/041 queue,
// BR-043 rejection taxonomy). Every schema is .strict() per doc 09 §4.2.

import { z } from 'zod'
import { listingStatusSchema } from './common'

// API-25 queue browser: any status, default PENDING; + keyset pagination (§1.4).
export const adminListQuerySchema = z
  .object({
    status: listingStatusSchema.default('PENDING'),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

// BR-043 rejection taxonomy — the reason travels verbatim to the seller. Each
// code has a Marathi label the client renders (rejectionLabelMr below).
export const rejectReasonSchema = z.enum([
  'SLAUGHTER_INTENT',
  'POOR_PHOTOS',
  'WRONG_CATEGORY',
  'DUPLICATE',
  'FRAUD_SUSPECTED',
  'PRICE_ABUSE',
  'CONTACT_IN_DESCRIPTION',
  'OTHER',
])
export type RejectReason = z.infer<typeof rejectReasonSchema>

// Marathi labels (design doc §S-20). Shown to the admin picker and to the seller
// on the rejected card. `OTHER` always pairs with the mandatory free-text detail.
export const rejectionLabelMr: Record<RejectReason, string> = {
  SLAUGHTER_INTENT: 'कत्तलीचा संशय',
  POOR_PHOTOS: 'फोटो स्पष्ट नाहीत',
  WRONG_CATEGORY: 'चुकीचा प्रकार निवडला',
  DUPLICATE: 'हीच जाहिरात आधीच आहे',
  FRAUD_SUSPECTED: 'फसवणुकीचा संशय',
  PRICE_ABUSE: 'किंमत चुकीची आहे',
  CONTACT_IN_DESCRIPTION: 'वर्णनात फोन नंबर आहे',
  OTHER: 'इतर कारण',
}

// API-26 approve / API-27 reject share the optimistic-review guard: the admin
// echoes back the updated_at of the version they reviewed; a mismatch means the
// seller edited mid-review → 409 STALE_REVIEW (F-10).
const expectedUpdatedAt = z.string().datetime({ offset: true })

export const approveSchema = z.object({ expectedUpdatedAt }).strict()

export const rejectSchema = z
  .object({
    reason: rejectReasonSchema,
    detail: z.string().trim().max(500).optional(),
    expectedUpdatedAt,
  })
  .strict()
  // BR-043: free-text detail is mandatory when the reason is OTHER.
  .superRefine((v, ctx) => {
    if (v.reason === 'OTHER' && !v.detail) {
      ctx.addIssue({
        code: 'custom',
        path: ['detail'],
        message: 'detail required when reason is OTHER',
      })
    }
  })

export type AdminListQuery = z.infer<typeof adminListQuerySchema>
export type ApproveInput = z.infer<typeof approveSchema>
export type RejectInput = z.infer<typeof rejectSchema>
