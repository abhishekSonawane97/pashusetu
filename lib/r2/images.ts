// R2/S3 image operations — docs/09-backend/README.md §7. Presigned uploads to
// the private bucket; on attach, sharp reads the original, generates WebP
// variants (EXIF stripped, resized), and writes them to the public bucket.

import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getS3, publicBucket, publicBaseUrl, uploadsBucket } from './client'
import {
  IMAGE_VARIANTS,
  VARIANT_WIDTH,
  originalKey,
  variantBase,
  variantKey,
  type ImageVariant,
} from './keys'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5 MB (BR-023)
export const PRESIGN_TTL = 600 // 10 min single-use window (NFR-08)
export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** API-15: presigned PUT bound to the key, content-type, and max size. */
export async function presignUpload(listingId: string, contentType: string, sizeBytes: number) {
  const imageCuid = randomUUID().replace(/-/g, '')
  const key = originalKey(listingId, imageCuid, contentType)
  const uploadUrl = await getSignedUrl(
    getS3(),
    new PutObjectCommand({
      Bucket: uploadsBucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes, // binds max size into the signature
    }),
    { expiresIn: PRESIGN_TTL },
  )
  return { key, uploadUrl, expiresIn: PRESIGN_TTL, headers: { 'Content-Type': contentType } }
}

// Magic-bytes signatures for the allowed types (server-side re-check, BR-023).
function sniff(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a')
    return 'image/png'
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp'
  return null
}

export type ProcessedImage = {
  r2Key: string
  url: string // variant base; imageUrls() appends /{variant}.webp
  width: number
  height: number
}

/**
 * Verify the uploaded original (exists, ≤5MB, real image), then generate + store
 * WebP variants in the public bucket. Returns the row fields for ListingImage,
 * or null if the object is missing / not a valid image.
 */
export async function processUpload(
  listingId: string,
  imageCuid: string,
  key: string,
): Promise<ProcessedImage | null> {
  const s3 = getS3()

  // Exists + size guard (HEAD before download).
  let contentLength = 0
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: uploadsBucket(), Key: key }))
    contentLength = head.ContentLength ?? 0
  } catch {
    return null // object not uploaded / wrong key
  }
  if (contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES) return null

  // Download the original and magic-bytes re-check (never trust the declared type).
  const obj = await s3.send(new GetObjectCommand({ Bucket: uploadsBucket(), Key: key }))
  const original = Buffer.from(await obj.Body!.transformToByteArray())
  if (!sniff(original)) return null

  // sharp is a NATIVE module — load it LAZILY (dynamic import) so routes that only
  // presign (and never process images) don't pull it into their module graph and
  // crash at load on Vercel. Turbopack bundles a static `import sharp` even with
  // serverExternalPackages set; a dynamic import is resolved from the external
  // package at runtime (kept external via serverExternalPackages: ['sharp']).
  const sharp = (await import('sharp')).default

  // EXIF is dropped because sharp re-encodes without copying metadata (GPS privacy, doc 12 §6).
  const meta = await sharp(original).metadata()
  await Promise.all(
    IMAGE_VARIANTS.map(async (variant: ImageVariant) => {
      const webp = await sharp(original)
        .rotate() // apply orientation, then discard EXIF
        .resize({ width: VARIANT_WIDTH[variant], withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
      await s3.send(
        new PutObjectCommand({
          Bucket: publicBucket(),
          Key: variantKey(listingId, imageCuid, variant),
          Body: webp,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable', // content-unique keys
        }),
      )
    }),
  )

  return {
    r2Key: key,
    url: variantBase(publicBaseUrl(), listingId, imageCuid),
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  }
}

/** Best-effort delete of an image's original + all public variants (API-17). */
export async function deleteImageObjects(listingId: string, imageCuid: string, r2Key: string) {
  const s3 = getS3()
  await Promise.allSettled([
    s3.send(new DeleteObjectCommand({ Bucket: uploadsBucket(), Key: r2Key })),
    ...IMAGE_VARIANTS.map((v) =>
      s3.send(
        new DeleteObjectCommand({
          Bucket: publicBucket(),
          Key: variantKey(listingId, imageCuid, v),
        }),
      ),
    ),
  ])
}
