// PhotoUploader — S-10c. Uploads 1–5 photos per BR-023 via the pipeline:
// presign (POST /uploads/presign) → PUT the file to storage → attach
// (POST /listings/{id}/images). Shows thumbnails with a delete affordance and a
// retry on failure. Client-side type/size pre-check mirrors the server guard.

'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { apiFetch } from '@/lib/api/client'
import { Icon } from '@/components/ui/Icon'

const MAX_PHOTOS = 5
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

export type UploadedPhoto = { id: string; cardUrl: string }

export function PhotoUploader({
  listingId,
  initial = [],
  onChange,
}: {
  listingId: string
  initial?: UploadedPhoto[]
  onChange?: (photos: UploadedPhoto[]) => void
}) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function update(next: UploadedPhoto[]) {
    setPhotos(next)
    onChange?.(next)
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setError(null)
    if (!ACCEPT.includes(file.type)) return setError('फक्त JPG, PNG किंवा WebP फोटो चालतात.')
    if (file.size > MAX_BYTES) return setError('फोटो खूप मोठा आहे. 5 MB पर्यंतच चालेल.')
    if (photos.length >= MAX_PHOTOS) return setError('जास्तीत जास्त 5 फोटो.')

    setBusy(true)
    try {
      // 1) presign
      const pres = await apiFetch('/api/v1/uploads/presign', {
        method: 'POST',
        body: JSON.stringify({ listingId, contentType: file.type, sizeBytes: file.size }),
      })
      if (!pres.ok) throw new Error('presign')
      const { key, uploadUrl, headers } = await pres.json()
      // 2) PUT the bytes straight to storage (no auth — signature is in the URL)
      const put = await fetch(uploadUrl, { method: 'PUT', headers, body: file })
      if (!put.ok) throw new Error('upload')
      // 3) attach → server generates WebP variants
      const att = await apiFetch(`/api/v1/listings/${listingId}/images`, {
        method: 'POST',
        body: JSON.stringify({ key }),
      })
      if (!att.ok) {
        const body = await att.json().catch(() => null)
        throw new Error(
          body?.error?.code === 'PHOTO_LIMIT_EXCEEDED' ? 'जास्तीत जास्त 5 फोटो.' : 'upload',
        )
      }
      const img = await att.json()
      update([...photos, { id: img.id, cardUrl: img.urls.card }])
    } catch (err) {
      setError(
        err instanceof Error && err.message !== 'upload' && !['presign'].includes(err.message)
          ? err.message
          : 'फोटो अपलोड झाला नाही. पुन्हा प्रयत्न करा.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove(imageId: string) {
    const prev = photos
    update(photos.filter((p) => p.id !== imageId)) // optimistic
    const res = await apiFetch(`/api/v1/listings/${listingId}/images/${imageId}`, {
      method: 'DELETE',
    })
    if (!res.ok && res.status !== 204) update(prev) // revert on failure
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-[var(--color-text-2)]">
        किमान 3 फोटो टाकल्यास जनावर लवकर विकले जाते. उन्हात, पूर्ण जनावर दिसेल असा फोटो काढा.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div
            key={p.id}
            className="relative aspect-square overflow-hidden rounded border border-[var(--color-border-card)]"
          >
            <Image
              src={p.cardUrl}
              alt={`फोटो ${i + 1}`}
              fill
              sizes="33vw"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => remove(p.id)}
              aria-label="फोटो काढा"
              className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <Icon name="close" size={18} title="फोटो काढा" />
            </button>
            {i === 0 && (
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[12px] text-white">
                मुख्य फोटो
              </span>
            )}
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-[var(--color-border-input)] text-[var(--color-text-2)] disabled:opacity-50"
          >
            {busy ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Icon name="camera" size={28} />
            )}
            <span className="text-[14px]">फोटो जोडा</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(',')}
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      {error && (
        <p role="alert" className="text-[14px] text-[var(--color-error)]">
          {error}
        </p>
      )}
      <p className="text-[14px] text-[var(--color-text-3)]">{photos.length} / 5 फोटो</p>
    </div>
  )
}
