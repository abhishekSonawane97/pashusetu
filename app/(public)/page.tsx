// S-05 home — browse entry: brand header, search-tap to filters, species chips,
// and the latest APPROVED listings. Public (BR-060). The search bar routes to
// S-06 (structured filters, not free text — F-12).

import { Suspense } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { SpeciesChips } from '@/components/listings/SpeciesChips'
import { ListingGrid } from '@/components/listings/ListingGrid'
import { Skeleton } from '@/components/ui/Skeleton'

export default function HomePage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-[26px] font-bold text-[var(--color-primary)]">पशुसेतू</h1>
        <Link
          href="/notifications"
          aria-label="सूचना"
          className="flex min-h-[var(--touch-min)] min-w-[var(--touch-min)] items-center justify-center text-[var(--color-text-2)]"
        >
          <Icon name="bell" size={24} title="सूचना" />
        </Link>
      </header>

      <Link
        href="/listings"
        className="flex min-h-[var(--h-input)] items-center gap-2 rounded border border-[var(--color-border-input)] bg-[var(--color-surface-2)] px-4 text-[var(--color-text-3)]"
      >
        <Icon name="search" size={20} />
        जनावर शोधा
      </Link>

      <SpeciesChips />

      <h2 className="mt-2 text-[20px] font-bold">नवीन जाहिराती</h2>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full" />
            ))}
          </div>
        }
      >
        <ListingGrid />
      </Suspense>
    </main>
  )
}
