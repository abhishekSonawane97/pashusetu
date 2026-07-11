// S3-compatible storage client — docs/09-backend/README.md §7 / D4.
// One client for both buckets. In dev it points at local MinIO (R2_ENDPOINT +
// path-style); in prod it targets Cloudflare R2 (endpoint derived from the
// account id, virtual-host style). Same code, env-only difference.

import { S3Client } from '@aws-sdk/client-s3'

let client: S3Client | undefined

export function getS3(): S3Client {
  if (client) return client
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2/S3 credentials missing — set R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY')
  }
  const endpoint =
    process.env.R2_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  client = new S3Client({
    // R2 accepts 'auto'; providers like Supabase/AWS validate the real region in
    // the SigV4 signature, so it must match the project region — set R2_REGION then.
    region: process.env.R2_REGION ?? 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // MinIO needs path-style (bucket in the path, not the host); R2 uses vhost.
    forcePathStyle: process.env.R2_FORCE_PATH_STYLE === '1',
    // AWS SDK v3 defaults to WHEN_SUPPORTED, which stamps CRC32 flexible-checksum
    // params (x-amz-sdk-checksum-algorithm / x-amz-checksum-crc32) into presigned
    // PutObject URLs. That makes the client expect the body sent with an aws-chunked
    // trailing checksum a browser fetch() cannot produce, so the presigned upload
    // PUT intermittently aborts against MinIO (and fails outright against R2, which
    // rejects the trailing checksum). WHEN_REQUIRED omits checksums for ops that
    // don't require them (PutObject), so the presigned PUT is a plain body upload.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return client
}

const prefix = () => process.env.R2_BUCKET ?? 'pashusetu-dev'
export const uploadsBucket = () => `${prefix()}-uploads` // private originals
export const publicBucket = () => `${prefix()}-public` // processed variants (public read)
export const publicBaseUrl = () =>
  process.env.R2_PUBLIC_BASE_URL ?? 'http://localhost:9000/pashusetu-dev-public'
