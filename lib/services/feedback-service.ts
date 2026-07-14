// Feedback service (NFR-10). submit() accepts both anonymous and signed-in callers
// — the userId is attached only when a valid token was present (optionalAuth in the
// route). list()/setStatus() back the admin inbox; admin identity is verified in the
// route (requireAdmin). No listing link: this is app-level feedback, not the
// listing-abuse Report flow.

import type { AuthContext } from '@/lib/auth/auth-context'
import { AppError } from '@/lib/errors/app-error'
import type { CreateFeedbackInput } from '@/lib/validation/feedback'
import type { FeedbackStatus } from '@prisma/client'
import * as feedbackRepo from '@/lib/repositories/feedback-repo'

const LIST_LIMIT = 50

export async function submit(ctx: AuthContext | null, input: CreateFeedbackInput) {
  const row = await feedbackRepo.createFeedback({
    type: input.type,
    message: input.message,
    contact: input.contact ?? null,
    userId: ctx?.user.id ?? null,
    path: input.path ?? null,
  })
  return { id: row.id, status: row.status }
}

export async function list(opts: { status?: FeedbackStatus }) {
  const [items, newCount] = await Promise.all([
    feedbackRepo.listFeedback({ status: opts.status, limit: LIST_LIMIT }),
    feedbackRepo.countNewFeedback(),
  ])
  return { items, newCount }
}

export async function setStatus(id: string, status: FeedbackStatus) {
  const count = await feedbackRepo.setFeedbackStatus(id, status)
  if (count === 0) throw AppError.notFound()
  return { id, status }
}
