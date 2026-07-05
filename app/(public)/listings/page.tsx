// S-06 search results — filter bar (opens FilterSheet) + the results grid.
// Public (BR-060). Filter state lives entirely in the URL (F-04 AC-6); back
// restores it. Client component because the filter sheet + grid are interactive.

'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { ListingGrid } from '@/components/listings/ListingGrid'
import { FilterSheet } from '@/components/listings/FilterSheet'

function SearchResults() {
  const router = useRouter()
  const [filterOpen, setFilterOpen] = useState(false)

  return (
    <main className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="मागे"
          className="flex min-h-[var(--touch-min)] min-w-[var(--touch-min)] items-center justify-center text-[var(--color-text)]"
        >
          <Icon name="arrowLeft" size={24} title="मागे" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold">जाहिराती</h1>
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="flex min-h-[var(--touch-min)] items-center gap-1 rounded border border-[var(--color-border-card)] px-3 font-bold text-[var(--color-text)]"
        >
          <Icon name="filter" size={20} />
          फिल्टर
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
