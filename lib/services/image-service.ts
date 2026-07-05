// Image service — API-15 presign, API-16 attach, API-17 delete (doc 09 §7).
// Photo edits allowed only while a listing can hold photos (BR-028); ≤5 photos
// (BR-023); keys are listing-scoped and re-verified server-side (SEC-T05).

import { AppError } from '@/lib/errors/app-error'
import type { AuthContext } from '@/lib/auth/auth-context'
import * as listingRepo from '@/lib/repositories/listing-repo'
import * as r2 from '@/lib/r2/images'
import { imageCuidFromKey, listingIdFromKey } from '@/lib/r2/keys'
import type { PresignInput, AttachImageInput } from '@/lib/validation/images'

const PHOTO_LIMIT = 5 // BR-023
// Statuses that permit photo edits (BR-028): not EXPIRED/SOLD/ARCHIVED.
const PHOTO_EDITABLE = ['DRAFT', 'PENDING', 'REJECTED', 'APPROVED']

async function ownedEditable(ctx: AuthContext, listingId: string) {
  const row = await listingRepo.findOwned(listingId)
  if (!row) throw AppError.listingNotFound()
  if (row.sellerId !== ctx.user.id) throw AppError.forbidden()
  if (!PHOTO_EDITABLE.includes(row.status)) throw AppError.editNotAllowed(row.status)
  return row
}

/** API-15: presigned PUT (type/size pre-validated by the schema). */
export async function presign(ctx: AuthContext, input: PresignInput) {
  await ownedEditable(ctx, input.listingId)
  return r2.presignUpload(input.listingId, input.contentType, input.sizeBytes)
}

/** API-16: attach an uploaded object — prefix check, magic-bytes re-check, variant gen, ≤5 cap. */
export async function attachImage(ctx: AuthContext, listingId: string, input: AttachImageInput) {
  await ownedEditable(ctx, listingId)

  // The key MUST be one API-15 issued for THIS listing (SEC-T05 — no foreign/guessed keys).
  const keyListingId = listingIdFromKey(input.key)
  const imageCuid = imageCuidFromKey(input.key)
  if (keyListingId !== listingId || !imageCuid) {
    throw AppError.invalidUpload('key does not belong to this listing')
  }

  // Verify + process (HEAD, size, magic bytes, WebP variants). null = bad/missing object.
  const processed = await r2.processUpload(listingId, imageCuid, input.key)
  if (!processed) throw AppError.invalidUpload('object missing or not a valid JPEG/PNG/WebP ≤ 5 MB')

  const added = await listingRepo.addImageWithLimit(listingId, processed, PHOTO_LIMIT)
  if (!added) {
    // Rolled back at the cap — clean up the just-written variants (no orphan public objects).
    await r2.deleteImageObjects(listingId, imageCuid, input.key)
    throw AppError.photoLimitExceeded(PHOTO_LIMIT)
  }
  return {
    id: added.imageId,
    sortOrder: added.sortOrder,
    width: processed.width,
    height: processed.height,
    urls: {
      thumb: `${processed.url}/thumb.webp`,
      card: `${processed.url}/card.webp`,
      detail: `${processed.url}/detail.webp`,
    },
  }
}

/** API-17: delete an image (owner). Removes the row, then best-effort R2 cleanup. */
export async function deleteImage(ctx: AuthContext, listingId: string, imageId: string) {
  await ownedEditable(ctx, listingId)
  const img = await listingRepo.findImage(listingId, imageId)
  if (!img) throw AppError.notFound()
  await listingRepo.deleteImageRow(imageId)
  const imageCuid = imageCuidFromKey(img.r2Key)
  if (imageCuid) await r2.deleteImageObjects(listingId, imageCuid, img.r2Key)
}
