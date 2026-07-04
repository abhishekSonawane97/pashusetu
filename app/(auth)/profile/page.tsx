'use client'

// S-04 profile setup — first-login step after OTP (docs/05-features/profile.md,
// doc 08 API-01). Minimal functional version: name + district (required,
// BR-013), village optional; Places-assist and the full F-02 polish land with
// the PS-012 UI completion. On success → returnTo (auth.md §6).

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'

type District = { id: string; nameEn: string; nameMr: string }

function ProfileSetup() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') ?? '/'

  const [districts, setDistricts] = useState<District[]>([])
  const [name, setName] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [village, setVillage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    apiFetch('/api/v1/meta/districts')
      .then((r) => r.json())
      .then((d) => setDistricts(d.items ?? []))
      .catch(() => setError('जिल्ह्यांची यादी मिळाली नाही. इंटरनेट तपासा.'))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      const res = await apiFetch('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          name,
          districtId,
          ...(village.trim() ? { village: village.trim() } : {}),
        }),
      })
      if (res.status === 201) {
        router.replace(returnTo)
        return
      }
      const body = await res.json().catch(() => null)
      if (body?.error?.code === 'USER_ALREADY_EXISTS') {
        router.replace(returnTo) // idempotent recovery (BR-010)
        return
      }
      if (body?.error?.details?.fields) {
        setFieldErrors(body.error.details.fields as Record<string, string>)
      } else {
        setError(body?.error?.message ?? 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.')
      }
    } catch {
      setError('इंटरनेट नाही. पुन्हा प्रयत्न करा.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-5 pt-6">
      <div>
        <h1 className="text-[22px] font-bold">तुमची माहिती भरा</h1>
        <p className="mt-2 text-[16px] text-[var(--color-text-2)]">
          फक्त नाव आणि जिल्हा — एका मिनिटात पूर्ण होईल.
        </p>
      </div>
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <TextField
          label="तुमचे नाव"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          error={fieldErrors.name ? 'नाव तपासा (किमान 2 अक्षरे, फोन नंबर नको)' : null}
        />

        <SelectField
          label="जिल्हा निवडा"
          value={districtId}
          onChange={(e) => setDistrictId(e.target.value)}
          error={fieldErrors.districtId ? 'जिल्हा निवडा' : null}
        >
          <option value="">जिल्हा निवडा</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nameMr} ({d.nameEn})
            </option>
          ))}
        </SelectField>

        <TextField
          label="गाव (ऐच्छिक)"
          value={village}
          onChange={(e) => setVillage(e.target.value)}
          error={fieldErrors.village ? 'गावाचे नाव तपासा (फोन नंबर नको)' : null}
        />

        {error && (
          <p role="alert" className="text-[14px] text-[var(--color-error)]">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} disabled={!name.trim() || !districtId}>
          पुढे जा
        </Button>
      </form>
    </section>
  )
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileSetup />
    </Suspense>
  )
}
