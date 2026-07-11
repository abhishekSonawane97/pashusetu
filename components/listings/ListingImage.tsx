// Listing image with a graceful fallback (S-05/S-06/S-07). Renders the photo via
// next/image (fill); if there is no URL, or the image fails to load, it shows the
// branded animal placeholder instead of a blank grey box. The parent MUST be
// `relative` with a fixed aspect ratio — the image/placeholder fill it.

'use client'

import Image from 'next/image'
import { useState } from 'react'

const PLACEHOLDER = '/placeholder-animal.svg'

export function ListingImage({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string | null
  alt: string
  sizes?: string
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    // The SVG is 4:3 with its own background, so `cover` fits a 4:3 box exactly.
    return (
      <div
        role="img"
        aria-label={alt}
        className="absolute inset-0 bg-[var(--color-muted)] bg-cover bg-center"
        style={{ backgroundImage: `url(${PLACEHOLDER})` }}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      // Listing photos are ALREADY optimized — the upload pipeline pre-generates the
      // exact WebP variants (thumb/card/detail), so we skip the Next image optimizer
      // and serve them straight from the storage CDN. This is cost-predictable (no
      // metered per-request optimization) and provider-agnostic (no remotePatterns
      // coupling — works for MinIO/Supabase/R2 alike). See docs/13 §8.
      unoptimized
      className="object-cover"
      onError={() => setFailed(true)}
    />
  )
}
