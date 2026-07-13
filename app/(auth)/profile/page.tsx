'use client'

// S-04 profile setup — first-login step after OTP (docs/05-features/profile.md,
// doc 08 API-01). Minimal functional version: name + district (required,
// BR-013), village optional; Places-assist and the full F-02 polish land with
// the PS-012 UI completion. On success → returnTo (auth.md §6).

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { safeReturnTo } from '@/lib/auth/otp-helpers'
import { useAuth } from '@/lib/firebase/use-auth'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/layout/Container'
import { SelectField, TextField } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'

type District = { id: string; nameEn: string; nameMr: string }

function ProfileSetup() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('returnTo')) // guard open redirect
  const auth = useAuth()

  const [districts, setDistricts] = useState<District[]>([])
  const [name, setName] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [taluka, setTaluka] = useState('')
  const [talukas, setTalukas] = useState<string[]>([])
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

  // Taluka suggestions depend on the chosen district (free-text still allowed —
  // there is no canonical taluka master list). Reset the value on district change.
  useEffect(() => {
    if (!districtId) {
      setTalukas([])
      return
    }
    apiFetch(`/api/v1/meta/talukas?districtId=${encodeURIComponent(districtId)}`)
      .then((r) => r.json())
      .then((d) => setTalukas(d.items ?? []))
      .catch(() => {})
  }, [districtId])

  // This setup page needs a login session (identity comes from the token). A
  // logged-out visitor — e.g. tapping the प्रोफाइल tab — would otherwise be
  // stranded here submitting into a 401 with no way to sign in. Send them to
  // login; after OTP they land back here (with a session) or home.
  useEffect(() => {
    if (auth.status === 'out') router.replace('/login?returnTo=%2F')
  }, [auth.status, router])

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
          ...(taluka.trim() ? { taluka: taluka.trim() } : {}),
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

  // While the session resolves ('loading'), or briefly before the redirect fires
  // ('out'), show a skeleton instead of a form that can't be submitted.
  if (auth.status !== 'in') {
    return (
      <div className="flex flex-col gap-3 pt-6" aria-busy>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
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
          onChange={(e) => {
            setDistrictId(e.target.value)
            setTaluka('') // taluka suggestions change with district
          }}
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
          label="तालुका (ऐच्छिक)"
          hint="सुरुवात करा — जुळणारे तालुके सुचवले जातील"
          value={taluka}
          onChange={(e) => setTaluka(e.target.value)}
          suggestions={talukas}
          error={fieldErrors.taluka ? 'तालुका तपासा' : null}
        />

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
    <Container variant="form">
      <Suspense>
        <ProfileSetup />
      </Suspense>
    </Container>
  )
}
