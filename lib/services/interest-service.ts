// Interest service — API-21 / F-06. The single phone-reveal path in the system
// (BR-062): a buyer taps Call / WhatsApp / Send-Interest on an APPROVED listing;
// we log exactly one interest_events row and, in the SAME transaction, return the
// seller's phone + a server-built wa.me link. Order matters — the row commits
// before the reveal payload is built (doc 07 §1.7 / §5.7). The seller
// notification for INTEREST (NTF-INTEREST-RECEIVED) is deferred to the
// notifications epic; see the hook below.

import { AppError } from '@/lib/errors/app-error'
import type { AuthContext } from '@/lib/auth/auth-context'
import type { InterestType } from '@/lib/validation/common'
import type { InterestResponse } from '@/lib/api/types'
import { prisma } from '@/lib/prisma'
import * as interestRepo from '@/lib/repositories/interest-repo'
import { buildWhatsappUrl, speciesMr } from '@/lib/contact/whatsapp'
import { absoluteUrl } from '@/lib/seo/site'

const DAILY_LIMIT = 20 // BR-064 — 20 events/buyer, all types + listings combined
const WINDOW_MS = 24 * 60 * 60 * 1000

export async function logInterestAndReveal(
  ctx: AuthContext,
  listingId: string,
  type: InterestType,
): Promise<InterestResponse> {
  const now = Date.now()
  const since = new Date(now - WINDOW_MS)

  return prisma.$transaction(async (tx) => {
    // Reveal target — only an APPROVED listing exposes a phone (BR-062). Anything
    // else (missing / DRAFT / PENDING / SOLD / …) → 404, which also masks
    // existence of non-public listings (BR-066, no oracle).
    const target = await interestRepo.revealTarget(tx, listingId)
    if (!target || target.status !== 'APPROVED') throw AppError.listingNotFound()

    // A seller cannot express interest in their own listing (BR-062).
    if (target.sellerId === ctx.user.id) throw AppError.forbidden({ reason: 'OWN_LISTING' })

    // An APPROVED listing always has a breed + price (enforced at submit, BR-022);
    // narrow the DRAFT-nullable columns and fail safe if a row is ever inconsistent.
    if (!target.breed || target.priceInr == null) throw AppError.listingNotFound()

    // BR-064 rolling-24h cap (counted inside the txn so it can't be raced).
    const recent = await interestRepo.countBuyerEventsSince(tx, ctx.user.id, since)
    if (recent >= DAILY_LIMIT) {
      const oldest = await interestRepo.oldestEventSince(tx, ctx.user.id, since)
      const retryAfter = oldest
        ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + WINDOW_MS - now) / 1000))
        : WINDOW_MS / 1000
      throw AppError.rateLimited(retryAfter)
    }

    // Log first, reveal second — the event is the audit truth for G-04 (doc 07 §5.7).
    const event = await interestRepo.createEvent(tx, { listingId, buyerId: ctx.user.id, type })

    // NOTE: type === 'INTEREST' should also notify the seller (NTF-INTEREST-RECEIVED,
    // BR-071). Deferred to the notifications epic — the event is already logged, so
    // no data is lost; wiring the notification here is the only remaining step.

    const whatsappUrl = buildWhatsappUrl(target.seller.phone, {
      speciesMr: speciesMr(target.species),
      breedMr: target.breed.nameMr,
      priceInr: target.priceInr,
      listingUrl: absoluteUrl(`/listings/${listingId}`),
    })

    return {
      id: event.id,
      listingId,
      type,
      createdAt: event.createdAt.toISOString(),
      seller: {
        name: target.seller.name.trim().split(/\s+/)[0], // first name only (BR-066 consistency)
        phone: target.seller.phone,
        whatsappUrl,
      },
    }
  })
}
