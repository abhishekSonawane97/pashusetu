// Image endpoint schemas — doc 08 API-15/16. Content type + size validated
// before any byte is uploaded (BR-023, NFR-08).
import { z } from 'zod'
import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES } from '@/lib/r2/images'
import { cuidSchema } from './common'

export const presignSchema = z
  .object({
    listingId: cuidSchema,
    contentType: z.enum(ALLOWED_CONTENT_TYPES), // jpeg/png/webp only — HEIC/video rejected here
    sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  })
  .strict()
export type PresignInput = z.infer<typeof presignSchema>

export const attachImageSchema = z
  .object({
    key: z.string().min(1),
    width: z.number().int().min(1).max(10000).optional(),
    height: z.number().int().min(1).max(10000).optional(),
  })
  .strict()
export type AttachImageInput = z.infer<typeof attachImageSchema>
