// ListingCard — the core browse unit (doc 10 §3, S-05/S-06). Shows photo,
// species+breed, formatted price, district, age, and a milk-yield badge when
// present. Unset optional fields are OMITTED entirely (design hard rule 3 —
// never "–"/"N/A"). Explicit image dimensions → zero CLS (hard rule 7).

import Link from 'next/link'
import Image from 'next/image'
import { Icon } from '@/components/ui/Icon'
import type { ListingCard as ListingCardData } from '@/lib/api/types'
import { ageMonthsToMr, formatInr, timeSinceMr } from '@/lib/utils/format'

const SPECIES_MR: Record<ListingCardData['species'], string> = {
  COW: 'गाय',
  BUFFALO: 'म्हैस',
  BULL_OX: 'बैल',
  GOAT: 'शेळी',
  SHEEP: 'मेंढी',
}

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const title = `${listing.breed.nameMr} ${SPECIES_MR[listing.species]}`
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="block overflow-hidden rounded-card border border-[var(--color-border-card)] bg-[var(--color-surface)] shadow-card"
    >
      <div className="relative aspect-[4/3] w-full bg-[var(--color-muted)]">
        {listing.thumbnailUrl ? (
          <Image
            src={listing.thumbnailUrl}
            alt={title}
            fill
            sizes="(max-width: 480px) 50vw, 240px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--color-text-3)]">
            <Icon name="gallery" size={32} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="text-[18px] font-bold text-[var(--color-primary)]">
          {formatInr(listing.priceInr)}
          {listing.negotiable && (
            <span className="ml-2 align-middle text-[14px] font-normal text-[var(--color-text-2)]">
              बोलणी होऊ शकते
            </span>
          )}
        </p>
        <p className="text-[16px] font-bold text-[var(--color-text)]">{title}</p>
        <div className="flex items-center gap-1 text-[14px] text-[var(--color-text-2)]">
          <Icon name="location" size={16} />
          <span>{listing.village}</span>
          <span aria-hidden>·</span>
          <span>{listing.district.nameMr}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[var(--color-text-2)]">
          <span>वय {ageMonthsToMr(listing.ageMonths)}</span>
          {/* Milk-yield badge only when present — omit entirely otherwise (hard rule 3). */}
          {listing.milkYieldLpd != null && listing.milkYieldLpd > 0 && (
            <span className="rounded-full bg-[var(--color-success-bg)] px-2 py-0.5 font-bold text-[var(--color-success)]">
              {listing.milkYieldLpd} लि/दिवस
            </span>
          )}
          {listing.isPregnant && (
            <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5">गाभण</span>
          )}
        </div>
        <p className="text-[14px] text-[var(--color-text-3)]">{timeSinceMr(listing.approvedAt)}</p>
      </div>
    </Link>
  )
}
