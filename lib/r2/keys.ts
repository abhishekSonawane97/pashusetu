// R2/S3 object-key scheme — docs/09-backend/README.md §7. Keys are server-
// generated and listing-scoped; clients never choose them (SEC-T05).

export const IMAGE_VARIANTS = ['thumb', 'card', 'detail'] as const
export type ImageVariant = (typeof IMAGE_VARIANTS)[number]

// Variant target widths (px). thumb=grid/search, card=list, detail=S-07 viewer.
export const VARIANT_WIDTH: Record<ImageVariant, number> = { thumb: 400, card: 800, detail: 1600 }

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Original upload (private bucket): listings/{listingId}/original/{imageCuid}.{ext} */
export function originalKey(listingId: string, imageCuid: string, contentType: string): string {
  return `listings/${listingId}/original/${imageCuid}.${EXT[contentType] ?? 'bin'}`
}

/** Processed variant (public bucket): listings/{listingId}/{imageCuid}/{variant}.webp */
export function variantKey(listingId: string, imageCuid: string, variant: ImageVariant): string {
  return `listings/${listingId}/${imageCuid}/${variant}.webp`
}

/** Base path stored in ListingImage.url; imageUrls() appends /{variant}.webp. */
export function variantBase(publicBase: string, listingId: string, imageCuid: string): string {
  return `${publicBase}/listings/${listingId}/${imageCuid}`
}

/** The listing id a key belongs to, or null — enforces the API-16 prefix check. */
export function listingIdFromKey(key: string): string | null {
  return /^listings\/([^/]+)\/original\//.exec(key)?.[1] ?? null
}

/** The image cuid embedded in an original key (filename without extension). */
export function imageCuidFromKey(key: string): string | null {
  return /\/original\/([^/.]+)\.[^/]+$/.exec(key)?.[1] ?? null
}
