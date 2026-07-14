// Feedback body schemas (NFR-10). App feedback / problem reports — anonymous is
// allowed, so nothing here identifies the user; userId is attached in the service
// only when the caller is authenticated. message is the one required free-text field.

import { z } from 'zod'

export const feedbackTypeSchema = z.enum(['PROBLEM', 'SUGGESTION', 'OTHER'])
export const feedbackStatusSchema = z.enum(['NEW', 'SEEN', 'DONE'])

export const createFeedbackSchema = z
  .object({
    type: feedbackTypeSchema,
    message: z.string().trim().min(3).max(1000), // the actual problem / suggestion
    contact: z.string().trim().min(1).max(120).optional(), // optional phone/name for follow-up
    path: z.string().trim().max(200).optional(), // in-app path they were on, for context
  })
  .strict()

export const updateFeedbackStatusSchema = z.object({ status: feedbackStatusSchema }).strict()

// Admin inbox filter — status optional (absent = all). Page size is fixed in the
// service (low volume at launch; keyset pagination is a documented later step).
export const adminFeedbackQuerySchema = z.object({ status: feedbackStatusSchema.optional() }).strict()

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>
export type UpdateFeedbackStatusInput = z.infer<typeof updateFeedbackStatusSchema>
