// Hero slider (S-05 landing) — a ~70vh auto-rotating, swipeable showcase of
// featured animals at the top of the home page. Each slide is the animal's photo
// with a price/breed/location overlay and links to its detail. Client component:
// it fetches the latest APPROVED listings (same source as the feed, so the home
// page stays static) and drives the auto-advance + active-dot state. Shows a 70vh
// skeleton while loading and renders nothing if there are no listings.

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { Icon } from '@/components/ui/Icon'
import { ListingImage } from './ListingImage'
import { formatInr } from '@/lib/utils/format'
import type { ListingCard, Paginated } from '@/lib/api/types'
import type { Species } from '@/lib/validation/common'

const SPECIES_MR: Record<Species, string> = {
  COW: 'गाय',
  BUFFALO: 'म्हैस',
  BULL_OX: 'बैल',
  GOAT: 'शेळी',
  SHEEP: 'मेंढी',
  REDA: 'रेडा',
}

// Cards carry the card-sized variant; the hero is full-bleed, so use the larger
// detail variant for sharpness (same object, different suffix).
const heroImage = (thumb: string | null) => (thumb ? thumb.replace('/card.webp', '/detail.webp') : null)

export function HeroSlider() {
  const [slides, setSlides] = useState<ListingCard[] | null>(null)
  const [active, setActive] = useState(0)
  const trackRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/v1/listings?limit=6')
      .then((r) => (r.ok ? (r.json() as Promise<Paginated<ListingCard>>) : null))
      .then((p) => {
        if (!cancelled) setSlides(p?.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setSlides([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-advance every 4.5s. Computes the next index from the live scroll position,
  // so a manual swipe just continues from wherever the user left off.
  useEffect(() => {
    if (!slides || slides.length <= 1) return
    const t = setInterval(() => {
      const el = trackRef.current
      if (!el) return
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
    }, 4500)
    return () => clearInterval(t)
  }, [slides])

  if (slides === null) {
    return <div className="-mx-4 h-[50vh] animate-pulse bg-[var(--color-muted)]" aria-busy />
  }
  if (slides.length === 0) return null

  return (
    <div className="relative -mx-4">
      <div
        ref={trackRef}
        onScroll={(e) =>
          setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
        }
        className="flex h-[50vh] snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            className="relative h-[50vh] w-full shrink-0 snap-center bg-[var(--color-muted)]"
          >
            <ListingImage
              src={heroImage(s.thumbnailUrl)}
              alt={`${s.breed.nameMr} ${SPECIES_MR[s.species]}`}
              sizes="100vw"
              priority={i === 0}
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-4 pb-8 text-white">
              <p className="text-[28px] font-bold leading-tight">{formatInr(s.priceInr)}</p>
              <p className="text-[18px] font-bold">
                {s.breed.nameMr} {SPECIES_MR[s.species]}
              </p>
              <p className="text-[14px] text-white/85">
                {[s.village, s.taluka, s.district.nameMr].filter(Boolean).join(', ')}
              </p>
              {/* Explicit CTA — the slide itself isn't a link (keeps swipe clean and
                  lets a real button own the navigation to the detail page). */}
              <Link
                href={`/listings/${s.id}`}
                className="mt-2 inline-flex min-h-[var(--touch-min)] items-center gap-1 rounded-full bg-[var(--color-primary)] px-5 text-[15px] font-bold text-[var(--color-on-primary)]"
              >
                तपशील पहा
                <Icon name="chevronRight" size={18} />
              </Link>
            </div>
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={'h-2 w-2 rounded-full ' + (i === active ? 'bg-white' : 'bg-white/50')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
