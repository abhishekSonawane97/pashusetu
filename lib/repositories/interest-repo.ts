// Interest repository (API-21 / BR-062). The three queries the reveal transaction
// needs: the phone-reveal projection (the ONLY non-admin place User.phone is
// selected), the rolling-24h buyer event count (BR-064), and the append-only
// event insert. All take a TransactionClient so the service can run them in one
// atomic $transaction (the row must commit before the phone is returned).

import type { InterestType, Prisma } from '@prisma/client'

// Everything the reveal + WhatsApp prefill need, and nothing else. Phone here is
// the BR-066 exception — egress is gated by the service (APPROVED + not owner).
const revealSelect = {
  status: true,
  sellerId: true,
  species: true,
  priceInr: true,
  seller: { select: { id: true, name: true, phone: true } },
  breed: { select: { nameMr: true } },
} satisfies Prisma.ListingSelect

export type RevealTargetRow = Prisma.ListingGetPayload<{ select: typeof revealSelect }>

export function revealTarget(
  tx: Prisma.TransactionClient,
  listingId: string,
): Promise<RevealTargetRow | null> {
  return tx.listing.findUnique({ where: { id: listingId }, select: revealSelect })
}

/** BR-064 rolling window — counts the buyer's events since `since` (uses interest_events_buyer_idx). */
export function countBuyerEventsSince(
  tx: Prisma.TransactionClient,
  buyerId: string,
  since: Date,
): Promise<number> {
  return tx.interestEvent.count({ where: { buyerId, createdAt: { gte: since } } })
}

/** Oldest event still inside the window — used only on the rate-limit path to compute retry-after. */
export function oldestEventSince(
  tx: Prisma.TransactionClient,
  buyerId: string,
  since: Date,
): Promise<{ createdAt: Date } | null> {
  return tx.interestEvent.findFirst({
    where: { buyerId, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  })
}

/** Append-only insert (doc 07 §5.7) — committed before the reveal payload is built. */
export function createEvent(
  tx: Prisma.TransactionClient,
  data: { listingId: string; buyerId: string; type: InterestType },
): Promise<{ id: string; createdAt: Date }> {
  return tx.interestEvent.create({ data, select: { id: true, createdAt: true } })
}
