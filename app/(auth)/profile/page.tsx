'use client'

// S-04 profile — for a NEW user this is the one-time setup form (name + district,
// BR-013; village/taluka optional). For a RETURNING user it shows their saved
// profile with an edit action, instead of blankly re-asking them to "create" one.
// Which view renders is decided by GET /users/me (404 = no profile yet → setup).

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
type Profile = {
  name: string
  phone: string
  districtId: string | null
  district: { id: string; nameMr: string } | null
  taluka: string | null
  village: string | null
}
type Mode = 'loading' | 'view' | 'edit' | 'setup'

// +918329914036 → +91 83299 14036 (readable for the account owner).
function fmtPhone(e164: string): string {
  const d = e164.replace(/^\+91/, '')
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : e164
}

function ProfileScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('returnTo')) // guard open redirect
  const auth = useAuth()

  const [mode, setMode] = useState<Mode>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)

  const [districts, setDistricts] = useState<District[]>([])
  const [name, setName] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [taluka, setTaluka] = useState('')
  const [talukas, setTalukas] = useState<string[]>([])
  const [village, setVillage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Login required — identity comes from the token. A logged-out visitor (e.g.
  // tapping the प्रोफाइल tab) goes to login and lands back here after OTP.
  useEffect(() => {
    if (auth.status === 'out') router.replace('/login?returnTo=%2Fprofile')
  }, [auth.status, router])

  // Existing profile? 404 = first login → setup form; 200 = show the saved profile.
  useEffect(() => {
    if (auth.status !== 'in') return
    let cancelled = false
    apiFetch('/api/v1/users/me')
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          setMode('setup')
          return
        }
        if (res.ok) {
          setProfile((await res.json()) as Profile)
          setMode('view')
          return
        }
        setError('माहिती मिळाली नाही. इंटरनेट तपासा.')
        setMode('setup')
      })
      .catch(() => {
        if (!cancelled) {
          setError('इंटरनेट नाही. पुन्हा प्रयत्न करा.')
          setMode('setup')
        }
      })
    return () => {
      cancelled = true
    }
  }, [auth.status])

  // Districts are only needed by the form (setup/edit).
  useEffect(() => {
    if (mode !== 'setup' && mode !== 'edit') return
    apiFetch('/api/v1/meta/districts')
      .then((r) => r.json())
      .then((d) => setDistricts(d.items ?? []))
      .catch(() => setError('जिल्ह्यांची यादी मिळाली नाही. इंटरनेट तपासा.'))
  }, [mode])

  // Taluka suggestions depend on the chosen district (free-text still allowed).
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

  function startEdit() {
    if (!profile) return
    setName(profile.name)
    setDistrictId(profile.districtId ?? '')
    setTaluka(profile.taluka ?? '')
    setVillage(profile.village ?? '')
    setError(null)
    setFieldErrors({})
    setMode('edit')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const isEdit = mode === 'edit'
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      // Setup (POST) omits empty optional fields; edit (PATCH) sends null to clear.
      const res = await apiFetch(isEdit ? '/api/v1/users/me' : '/api/v1/users', {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name,
          districtId,
          taluka: taluka.trim() ? taluka.trim() : isEdit ? null : undefined,
          village: village.trim() ? village.trim() : isEdit ? null : undefined,
        }),
      })
      if (res.ok) {
        if (isEdit) {
          setProfile((await res.json().catch(() => null)) as Profile | null)
          setMode('view')
        } else {
          router.replace(returnTo)
        }
        return
      }
      const body = await res.json().catch(() => null)
      if (!isEdit && body?.error?.code === 'USER_ALREADY_EXISTS') {
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

  // Session resolving / redirecting out / profile still loading → skeleton.
  if (auth.status !== 'in' || mode === 'loading') {
    return (
      <div className="flex flex-col gap-3 pt-6" aria-busy>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
  }

  if (mode === 'view' && profile) {
    return (
      <section className="flex flex-col gap-5 pt-6">
        <div>
          <h1 className="text-[22px] font-bold">माझी माहिती</h1>
          <p className="mt-2 text-[16px] text-[var(--color-text-2)]">तुमची नोंदणी पूर्ण झाली आहे.</p>
        </div>
        <dl className="flex flex-col divide-y divide-[var(--color-border-card)] rounded-card border border-[var(--color-border-card)]">
          <Row label="नाव" value={profile.name} />
          <Row label="मोबाईल नंबर" value={fmtPhone(profile.phone)} />
          <Row label="जिल्हा" value={profile.district?.nameMr ?? '—'} />
          <Row label="तालुका" value={profile.taluka || '—'} />
          <Row label="गाव" value={profile.village || '—'} />
        </dl>
        <Button variant="secondary" onClick={startEdit}>
          माहिती बदला
        </Button>
      </section>
    )
  }

  // setup | edit — the shared form.
  const isEdit = mode === 'edit'
  return (
    <section className="flex flex-col gap-5 pt-6">
      <div>
        <h1 className="text-[22px] font-bold">{isEdit ? 'माहिती बदला' : 'तुमची माहिती भरा'}</h1>
        <p className="mt-2 text-[16px] text-[var(--color-text-2)]">
          {isEdit ? 'बदल करून जतन करा.' : 'फक्त नाव आणि जिल्हा — एका मिनिटात पूर्ण होईल.'}
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
          {isEdit ? 'जतन करा' : 'पुढे जा'}
        </Button>
        {isEdit && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setMode('view')}>
            रद्द करा
          </Button>
        )}
      </form>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-[14px] text-[var(--color-text-3)]">{label}</dt>
      <dd className="text-[16px] font-bold text-[var(--color-text)]">{value}</dd>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Container variant="form">
      <Suspense>
        <ProfileScreen />
      </Suspense>
    </Container>
  )
}
