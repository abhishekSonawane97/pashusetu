// Feedback persistence (NFR-10). Create on submit; list + status update for the
// admin inbox. Newest-first, optional status filter. Volume is low at launch, so
// list returns a single recent page — keyset pagination is a documented later step.

import { prisma } from '@/lib/prisma'
import type { FeedbackStatus, FeedbackType } from '@prisma/client'

export function createFeedback(data: {
  type: FeedbackType
  message: string
  contact: string | null
  userId: string | null
  path: string | null
}) {
  return prisma.feedback.create({ data, select: { id: true, status: true } })
}

export function listFeedback(opts: { status?: FeedbackStatus; limit: number }) {
  return prisma.feedback.findMany({
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit,
    include: { user: { select: { id: true, name: true, phone: true } } },
  })
}

export function countNewFeedback() {
  return prisma.feedback.count({ where: { status: 'NEW' } })
}

/** updateMany (not update) so a missing id returns count 0 instead of throwing. */
export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<number> {
  const res = await prisma.feedback.updateMany({ where: { id }, data: { status } })
  return res.count
}
