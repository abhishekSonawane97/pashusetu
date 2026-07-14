// S-06 search results — filter bar (opens FilterSheet) + the results grid.
// Public (BR-060). Filter state lives entirely in the URL (F-04 AC-6); back
// restores it. Client component because the filter sheet + grid are interactive.

'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { ListingGrid } from '@/components/listings/ListingGrid'
import { FilterSheet } from '@/components/listings/FilterSheet'

// Filter keys that count toward the "active filters" badge (sort has its own rule).
const ACTIVE_FILTER_KEYS = [
  'species',
  'breedId',
  'districtId',
  'taluka',
  'minPrice',
  'maxPrice',
  'minMilk',
  'minAge',
  'maxAge',
  'isPregnant',
]

function SearchResults() {
  const router = useRouter()
  const params = useSearchParams()
  const [filterOpen, setFilterOpen] = useState(false)

  const activeCount =
    ACTIVE_FILTER_KEYS.filter((k) => params.get(k)).length +
    (params.get('sort') && params.get('sort') !== 'newest' ? 1 : 0)

  return (
    <main className="flex flex-col gap-4 p-4">
      {/* Sticky so the filter control + active-filter state stay reachable while the
          results scroll (Browse #3); shows an active-filter count + one-tap clear
          whenever any filter is set (Browse #2). */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center gap-2 border-b border-[var(--color-border-card)] bg-[var(--color-surface)] px-4 py-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="मागे"
          className="flex min-h-[var(--touch-min)] min-w-[var(--touch-min)] items-center justify-center text-[var(--color-text)]"
        >
          <Icon name="arrowLeft" size={24} title="मागे" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold">जाहिराती</h1>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => router.push('/listings')}
            className="min-h-[var(--touch-min)] px-2 text-[14px] font-bold text-[var(--color-primary)]"
          >
            सर्व काढा
          </button>
        )}
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="flex min-h-[var(--touch-min)] items-center gap-1 rounded border border-[var(--color-border-card)] px-3 font-bold text-[var(--color-text)]"
        >
          <Icon name="filter" size={20} />
          फिल्टर
          {activeCount > 0 && (
            <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[12px] font-bold text-[var(--color-on-primary)]">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <ListingGrid onClearFilters={() => router.push('/listings')} />
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </main>
  )
}

export default function ListingsPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  )
}
