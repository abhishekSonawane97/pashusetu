// ListingGrid — 2-up card grid with infinite scroll (doc 06 Flow E: 20/page,
// end marker, empty state with filter-reset CTA). Filter state comes from the
// URL (shareable, F-04 AC-6). When filters change the inner feed REMOUNTS via a
// key (clean reset — no synchronous setState in an effect); pages append via the
// opaque cursor. Offline/error keep already-loaded cards with a retry.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ListingCard } from './ListingCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import type { ListingCard as ListingCardData, Paginated } from '@/lib/api/types'

// Only these keys reach the API (doc 08 §4.1) — never arbitrary params.
const FILTER_KEYS = ['species', 'breedId', 'districtId', 'minPrice', 'maxPrice', 'sort'] as const

function buildQuery(params: URLSearchParams, cursor: string | null): string {
  const out = new URLSearchParams()
  for (const k of FILTER_KEYS) {
    const v = params.get(k)
    if (v) out.set(k, v)
  }
  if (cursor) out.set('cursor', cursor)
  return out.toString()
}

type LoadState = 'loading' | 'idle' | 'error'

function ListingFeed({
  filterQuery,
  onClearFilters,
}: {
  filterQuery: string
  onClearFilters?: () => void
}) {
  const [items, setItems] = useState<ListingCardData[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [state, setState] = useState<LoadState>('loading')
  const cursorRef = useRef<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Fetch a page and append. Does NOT set 'loading' itself — callers that run
  // outside an effect (scroll observer, retry click) set it; the initial mount
  // relies on the initial 'loading' state (avoids synchronous setState-in-effect).
  const loadNext = useCallback(async () => {
    try {
      const qs = filterQuery ? `${filterQuery}&` : ''
      const res = await fetch(
        `/api/v1/listings?${qs}${cursorRef.current ? `cursor=${encodeURIComponent(cursorRef.current)}` : ''}`,
      )
      if (!res.ok) throw new Error('search failed')
      const page: Paginated<ListingCardData> = await res.json()
      setItems((prev) => [...prev, ...page.items])
      cursorRef.current = page.nextCursor
      setCursor(page.nextCursor)
      setDone(page.nextCursor === null)
      setState('idle')
    } catch {
      setState('error')
    }
  }, [filterQuery])

  // Load page one on mount (remounted per filter set via the key on <ListingFeed>).
  useEffect(() => {
    void loadNext()
  }, [loadNext])

  // Infinite scroll: fetch the next page when the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || done || state !== 'idle' || !cursor) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setState('loading')
        void loadNext()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [done, state, cursor, loadNext])

  const retry = () => {
    setState('loading')
    void loadNext()
  }

  if (state === 'idle' && items.length === 0) {
    return (
      <EmptyState
        title="काहीही सापडले नाही. फिल्टर बदलून पुन्हा पहा."
        cta={
          onClearFilters ? (
            <Button variant="secondary" fullWidth={false} onClick={onClearFilters}>
              फिल्टर काढा
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
        {state === 'loading' &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`sk-${i}`} className="aspect-[3/4] w-full" />
          ))}
      </div>

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-[var(--color-error)]">इंटरनेट नाही. पुन्हा प्रयत्न करा.</p>
          <Button variant="secondary" fullWidth={false} onClick={retry}>
            पुन्हा प्रयत्न करा
          </Button>
        </div>
      )}

      {done && items.length > 0 && (
        <p className="py-6 text-center text-[14px] text-[var(--color-text-3)]">
          सर्व जाहिराती पाहिल्या
        </p>
      )}

      <div ref={sentinelRef} className="h-1" aria-hidden />
    </div>
  )
}

export function ListingGrid({ onClearFilters }: { onClearFilters?: () => void }) {
  const searchParams = useSearchParams()
  const filterQuery = buildQuery(searchParams, null)
  // Remount the feed whenever the filter set changes — clean state reset.
  return <ListingFeed key={filterQuery} filterQuery={filterQuery} onClearFilters={onClearFilters} />
}
