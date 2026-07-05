// PhotoCarousel — S-07 image viewer. Horizontal swipe/scroll with dot markers;
// explicit dimensions (zero CLS, hard rule 7). Photo-less listings show a
// neutral gallery placeholder. Client component for the active-dot state.

'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Icon } from '@/components/ui/Icon'

type Photo = { id: string; urls: { detail: string } }

export function PhotoCarousel({ photos, alt }: { photos: Photo[]; alt: string }) {
  const [active, setActive] = useState(0)
  const trackRef = useRef<HTMLDivElement | null>(null)

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-[var(--color-muted)] text-[var(--color-text-3)]">
        <Icon name="gallery" size={48} />
      </div>
    )
  }

  function onScroll() {
    const el = trackRef.current
    if (!el) return
    setActive(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {photos.map((p) => (
          <div
            key={p.id}
            className="relative aspect-[4/3] w-full shrink-0 snap-center bg-[var(--color-muted)]"
          >
            <Image
              src={p.urls.detail}
              alt={alt}
              fill
              sizes="100vw"
              className="object-cover"
              priority={false}
            />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden>
          {photos.map((p, i) => (
            <span
              key={p.id}
              className={
                'h-2 w-2 rounded-full ' +
                (i === active ? 'bg-[var(--color-on-primary)]' : 'bg-white/50')
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
