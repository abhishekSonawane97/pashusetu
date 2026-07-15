'use client'

// S-10 listing wizard (a–e): species/breed → details → photos → price/location
// → declaration+submit. Creates a DRAFT on step 1, PATCHes each step, submits at
// the end. Per-species conditional fields follow the BR-022 matrix. Bottom nav is
// hidden here (BottomNav HIDDEN /^\/sell\/new/). The declaration text is verbatim.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthGate } from '@/components/auth/AuthGate'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { PhotoUploader, type UploadedPhoto } from '@/components/forms/PhotoUploader'
import { apiFetch } from '@/lib/api/client'
import { formatInr } from '@/lib/utils/format'
import {
  fixedSexFor,
  lactationAllowed,
  milkYieldAllowed,
  pregnancyAllowed,
} from '@/lib/validation/listings'
import type { BreedRef, DistrictRef } from '@/lib/api/types'
import type { Sex, Species } from '@/lib/validation/common'

const SPECIES: Array<{ key: Species; label: string }> = [
  { key: 'COW', label: 'गाय' },
  { key: 'BUFFALO', label: 'म्हैस' },
  { key: 'BULL_OX', label: 'बैल' },
  { key: 'GOAT', label: 'शेळी' },
  { key: 'SHEEP', label: 'मेंढी' },
]
const DECLARATION =
  'मी जाहीर करतो/करते की मी या जनावराचा/जनावरीचा कायदेशीर मालक आहे, ही विक्री महाराष्ट्र राज्याच्या कायद्यांनुसार आहे, आणि हे जनावर कत्तलीसाठी विकले जात नाही.'

type Draft = {
  species?: Species
  breedId?: string
  sex?: Sex
  ageMonths?: string
  weightKg?: string
  milkYieldLpd?: string
  lactationNumber?: string
  isPregnant?: boolean
  isVaccinated?: boolean
  priceInr?: string
  negotiable?: boolean
  districtId?: string
  taluka?: string
  village?: string
  description?: string
}

// Which wizard step renders each field's error → jump the user to the earliest
// offending step when submit fails on a field that lives on a step they can't see
// (Sell #1). Server submit guards return keys from this set.
const FIELD_STEP: Record<string, number> = {
  breedId: 1,
  sex: 2,
  ageMonths: 2,
  weightKg: 2,
  milkYieldLpd: 2,
  lactationNumber: 2,
  isPregnant: 2,
  isVaccinated: 2,
  description: 2,
  photos: 3,
  priceInr: 4,
  negotiable: 4,
  districtId: 4,
  taluka: 4,
  village: 4,
}

// Shape of GET /listings/{id} we read to hydrate the wizard for edit/resume
// (relations come back as objects, numerics as numbers → mapped into Draft).
type LoadedListing = {
  species?: Species
  breed?: { id: string } | null
  sex?: Sex | null
  ageMonths?: number | null
  weightKg?: number | null
  milkYieldLpd?: number | null
  lactationNumber?: number | null
  isPregnant?: boolean | null
  isVaccinated?: boolean | null
  priceInr?: number | null
  negotiable?: boolean
  district?: { id: string } | null
  taluka?: string | null
  village?: string | null
  description?: string | null
  images?: Array<{ id: string; sortOrder: number; urls: { card: string } }>
}

function WizardInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<Draft>({ negotiable: true })
  const [listingId, setListingId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [breeds, setBreeds] = useState<BreedRef[]>([])
  const [districts, setDistricts] = useState<DistrictRef[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [declaration, setDeclaration] = useState(false)
  const [metaError, setMetaError] = useState(false)

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const sex = draft.species ? (fixedSexFor(draft.species) ?? draft.sex) : undefined

  // Edit / resume: /sell/new?id=<listingId> loads an existing listing (a saved
  // DRAFT to continue, or a live/REJECTED listing to edit) into the wizard instead
  // of starting a blank NEW one — so drafts resume and listings become editable
  // (My Listings #3 / #4). Owner token → GET returns all fields for any status.
  useEffect(() => {
    const id = params.get('id')
    if (!id) return
    let cancelled = false
    apiFetch(`/api/v1/listings/${id}`)
      .then((r) => (r.ok ? (r.json() as Promise<LoadedListing>) : null))
      .then((d) => {
        if (cancelled || !d) return
        setListingId(id)
        setDraft({
          species: d.species,
          breedId: d.breed?.id,
          sex: d.sex ?? undefined,
          ageMonths: d.ageMonths != null ? String(d.ageMonths) : undefined,
          weightKg: d.weightKg != null ? String(d.weightKg) : undefined,
          milkYieldLpd: d.milkYieldLpd != null ? String(d.milkYieldLpd) : undefined,
          lactationNumber: d.lactationNumber != null ? String(d.lactationNumber) : undefined,
          isPregnant: d.isPregnant ?? undefined,
          isVaccinated: d.isVaccinated ?? undefined,
          priceInr: d.priceInr != null ? String(d.priceInr) : undefined,
          negotiable: d.negotiable ?? true,
          districtId: d.district?.id,
          taluka: d.taluka ?? undefined,
          village: d.village ?? undefined,
          description: d.description ?? undefined,
        })
        setPhotos(
          (d.images ?? [])
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((img) => ({ id: img.id, cardUrl: img.urls.card })),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from the id param
  }, [])

  // Breed/district lists MUST load or the user can't advance (both are required).
  // On a flaky rural connection the fetch can fail — surface an error + retry
  // instead of a silently-empty required dropdown that dead-ends the flow (Sell #2).
  useEffect(() => {
    apiFetch('/api/v1/meta/districts')
      .then((r) => r.json())
      .then((d) => setDistricts(d.items ?? []))
      .catch(() => setMetaError(true))
  }, [])

  useEffect(() => {
    if (!draft.species) return
    apiFetch(`/api/v1/meta/breeds?species=${draft.species}`)
      .then((r) => r.json())
      .then((d) => setBreeds(d.items ?? []))
      .catch(() => setMetaError(true))
  }, [draft.species])

  function retryMeta() {
    setMetaError(false)
    apiFetch('/api/v1/meta/districts')
      .then((r) => r.json())
      .then((d) => setDistricts(d.items ?? []))
      .catch(() => setMetaError(true))
    if (draft.species)
      apiFetch(`/api/v1/meta/breeds?species=${draft.species}`)
        .then((r) => r.json())
        .then((d) => setBreeds(d.items ?? []))
        .catch(() => setMetaError(true))
  }

  // Build the PATCH/POST payload from the current draft (only set fields).
  function payload() {
    const p: Record<string, unknown> = {}
    if (draft.species) p.species = draft.species
    if (draft.breedId) p.breedId = draft.breedId
    if (sex) p.sex = sex
    if (draft.ageMonths) p.ageMonths = Number(draft.ageMonths)
    if (draft.weightKg) p.weightKg = Number(draft.weightKg)
    if (draft.milkYieldLpd && milkYieldAllowed(draft.species!, sex))
      p.milkYieldLpd = Number(draft.milkYieldLpd)
    if (draft.lactationNumber && lactationAllowed(draft.species!, sex))
      p.lactationNumber = Number(draft.lactationNumber)
    if (draft.isPregnant != null && pregnancyAllowed(draft.species!, sex))
      p.isPregnant = draft.isPregnant
    if (draft.isVaccinated != null) p.isVaccinated = draft.isVaccinated
    if (draft.priceInr) p.priceInr = Number(draft.priceInr)
    if (draft.negotiable != null) p.negotiable = draft.negotiable
    if (draft.districtId) p.districtId = draft.districtId
    if (draft.taluka) p.taluka = draft.taluka
    if (draft.village) p.village = draft.village
    if (draft.description) p.description = draft.description
    return p
  }

  // Persist the draft: create on first save, PATCH afterward. Returns the id.
  async function save(): Promise<string | null> {
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      const res = listingId
        ? await apiFetch(`/api/v1/listings/${listingId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload()),
          })
        : await apiFetch('/api/v1/listings', { method: 'POST', body: JSON.stringify(payload()) })
      const body = await res.json()
      if (!res.ok) {
        if (body?.error?.details?.fields) setFieldErrors(body.error.details.fields)
        else setError(body?.error?.message ?? 'जतन झाले नाही. पुन्हा प्रयत्न करा.')
        return null
      }
      setListingId(body.id)
      return body.id as string
    } catch {
      setError('इंटरनेट नाही. पुन्हा प्रयत्न करा.')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function next() {
    const id = await save()
    if (id) setStep((s) => s + 1)
  }

  async function submit() {
    if (!listingId) return
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      const res = await apiFetch(`/api/v1/listings/${listingId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ declarationAccepted: true }),
      })
      const body = await res.json()
      if (!res.ok) {
        const fields = body?.error?.details?.fields as Record<string, string> | undefined
        if (fields) {
          setFieldErrors(fields)
          // Jump to the earliest step that renders an offending field, so the user
          // lands on a screen where they can actually fix it (Sell #1).
          const steps = Object.keys(fields)
            .map((k) => FIELD_STEP[k])
            .filter((s): s is number => typeof s === 'number')
          if (steps.length) setStep(Math.min(...steps))
        }
        setError(body?.error?.message ?? 'जाहिरात पाठवता आली नाही.')
        return
      }
      router.replace('/sell?submitted=1')
    } catch {
      setError('इंटरनेट नाही. पुन्हा प्रयत्न करा.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <button
          type="button"
          aria-label="मागे"
          onClick={() => (step === 1 ? router.push('/sell') : setStep((s) => s - 1))}
          className="flex min-h-[var(--touch-min)] min-w-[var(--touch-min)] items-center justify-center"
        >
          <Icon name="arrowLeft" size={24} title="मागे" />
        </button>
        <div className="flex-1">
          <p className="text-[14px] text-[var(--color-text-2)]">पायरी {step} / 5</p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--color-muted)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {metaError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded border border-[var(--color-error)] bg-[var(--color-error-bg)] p-3 text-[14px] text-[var(--color-error)]"
        >
          <span>जात/जिल्ह्यांची यादी मिळाली नाही. इंटरनेट तपासा.</span>
          <button type="button" onClick={retryMeta} className="shrink-0 font-bold underline">
            पुन्हा प्रयत्न करा
          </button>
        </div>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h1 className="text-[22px] font-bold">कोणते जनावर विकायचे?</h1>
          <div className="flex flex-wrap gap-2">
            {SPECIES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => set({ species: s.key, breedId: undefined, sex: undefined })}
                aria-pressed={draft.species === s.key}
                className={
                  'min-h-[var(--touch-min)] rounded-full border px-5 text-[18px] font-bold ' +
                  (draft.species === s.key
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                    : 'border-[var(--color-border-card)]')
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          {draft.species && (
            <SelectField
              label="जात निवडा"
              value={draft.breedId ?? ''}
              onChange={(e) => set({ breedId: e.target.value })}
              error={fieldErrors.breedId ? 'जात निवडा' : null}
            >
              <option value="">जात निवडा</option>
              {breeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameMr}
                </option>
              ))}
            </SelectField>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <h1 className="text-[22px] font-bold">जनावराची माहिती</h1>
          {!fixedSexFor(draft.species!) && (
            <SelectField
              label="लिंग"
              value={draft.sex ?? ''}
              onChange={(e) => set({ sex: e.target.value as Sex })}
            >
              <option value="">निवडा</option>
              <option value="FEMALE">मादी</option>
              <option value="MALE">नर</option>
            </SelectField>
          )}
          <TextField
            label="वय (महिने)"
            type="number"
            inputMode="numeric"
            value={draft.ageMonths ?? ''}
            onChange={(e) => set({ ageMonths: e.target.value })}
            error={fieldErrors.ageMonths ? 'वय तपासा (1–300 महिने)' : null}
          />
          <TextField
            label="वजन (किलो, ऐच्छिक)"
            type="number"
            inputMode="numeric"
            value={draft.weightKg ?? ''}
            onChange={(e) => set({ weightKg: e.target.value })}
          />
          {milkYieldAllowed(draft.species!, sex) && (
            <TextField
              label="दूध उत्पादन (लिटर/दिवस)"
              type="number"
              inputMode="decimal"
              value={draft.milkYieldLpd ?? ''}
              onChange={(e) => set({ milkYieldLpd: e.target.value })}
              error={fieldErrors.milkYieldLpd ? 'दूध उत्पादन भरा' : null}
            />
          )}
          {lactationAllowed(draft.species!, sex) && (
            <TextField
              label="वेत (ऐच्छिक)"
              type="number"
              inputMode="numeric"
              value={draft.lactationNumber ?? ''}
              onChange={(e) => set({ lactationNumber: e.target.value })}
            />
          )}
          {pregnancyAllowed(draft.species!, sex) && (
            <label className="flex items-center gap-2 text-[16px]">
              <input
                type="checkbox"
                checked={!!draft.isPregnant}
                onChange={(e) => set({ isPregnant: e.target.checked })}
              />
              गाभण आहे
            </label>
          )}
          <label className="flex items-center gap-2 text-[16px]">
            <input
              type="checkbox"
              checked={!!draft.isVaccinated}
              onChange={(e) => set({ isVaccinated: e.target.checked })}
            />
            लसीकरण झाले आहे
          </label>
          <TextField
            label="माहिती (वर्णन)"
            value={draft.description ?? ''}
            onChange={(e) => set({ description: e.target.value })}
            error={
              fieldErrors.description
                ? fieldErrors.description.includes('phone')
                  ? 'वर्णनात फोन नंबर लिहू नका'
                  : 'वर्णन 10–1000 अक्षरे हवे'
                : null
            }
          />
        </section>
      )}

      {step === 3 && listingId && (
        <section className="flex flex-col gap-4">
          <h1 className="text-[22px] font-bold">फोटो जोडा</h1>
          <PhotoUploader listingId={listingId} initial={photos} onChange={setPhotos} />
        </section>
      )}

      {step === 4 && (
        <section className="flex flex-col gap-4">
          <h1 className="text-[22px] font-bold">किंमत आणि ठिकाण</h1>
          <TextField
            label="किंमत (₹)"
            type="number"
            inputMode="numeric"
            value={draft.priceInr ?? ''}
            onChange={(e) => set({ priceInr: e.target.value })}
            error={fieldErrors.priceInr ? 'किंमत ₹500 ते ₹10,00,000 दरम्यान हवी' : null}
          />
          <label className="flex items-center gap-2 text-[16px]">
            <input
              type="checkbox"
              checked={draft.negotiable ?? true}
              onChange={(e) => set({ negotiable: e.target.checked })}
            />
            किंमतीत बदल शक्य
          </label>
          <SelectField
            label="जिल्हा"
            value={draft.districtId ?? ''}
            onChange={(e) => set({ districtId: e.target.value })}
            error={fieldErrors.districtId ? 'जिल्हा निवडा' : null}
          >
            <option value="">जिल्हा निवडा</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameMr}
              </option>
            ))}
          </SelectField>
          <TextField
            label="तालुका"
            value={draft.taluka ?? ''}
            onChange={(e) => set({ taluka: e.target.value })}
            error={fieldErrors.taluka ? 'तालुका भरा' : null}
          />
          <TextField
            label="गाव"
            value={draft.village ?? ''}
            onChange={(e) => set({ village: e.target.value })}
            error={fieldErrors.village ? 'गावाचे नाव भरा' : null}
          />
        </section>
      )}

      {step === 5 && (
        <section className="flex flex-col gap-4">
          <h1 className="text-[22px] font-bold">तपासा आणि पाठवा</h1>
          {/* Full read-back so the seller can verify EVERY field before sending
              (mistakes otherwise bounce back as rejections) — Sell #3. Unset fields
              are omitted, mirroring the public detail page. */}
          <div className="flex flex-col gap-1 rounded-card border border-[var(--color-border-card)] p-3 text-[16px]">
            <p className="text-[18px] font-bold">
              {breeds.find((b) => b.id === draft.breedId)?.nameMr}{' '}
              {SPECIES.find((s) => s.key === draft.species)?.label}
            </p>
            {draft.priceInr && (
              <p className="font-bold text-[var(--color-primary)]">
                {formatInr(Number(draft.priceInr))}
                {draft.negotiable ? ' · बोलणी होऊ शकते' : ''}
              </p>
            )}
            {(
              [
                sex && ['लिंग', sex === 'FEMALE' ? 'मादी' : 'नर'],
                draft.ageMonths && ['वय', `${draft.ageMonths} महिने`],
                draft.weightKg && ['वजन', `${draft.weightKg} किलो`],
                draft.milkYieldLpd &&
                  milkYieldAllowed(draft.species!, sex) && [
                    'दूध',
                    `${draft.milkYieldLpd} लिटर/दिवस`,
                  ],
                draft.lactationNumber &&
                  lactationAllowed(draft.species!, sex) && ['वेत', draft.lactationNumber],
                draft.isPregnant &&
                  pregnancyAllowed(draft.species!, sex) && ['गाभण', 'होय'],
                draft.isVaccinated && ['लसीकरण', 'झाले आहे'],
                [
                  'ठिकाण',
                  [
                    draft.village,
                    draft.taluka,
                    districts.find((d) => d.id === draft.districtId)?.nameMr,
                  ]
                    .filter(Boolean)
                    .join(', '),
                ],
                ['फोटो', `${photos.length}`],
              ].filter(Boolean) as [string, string][]
            ).map(([l, v]) => (
              <div
                key={l}
                className="flex justify-between gap-3 border-t border-[var(--color-border-card)] pt-1"
              >
                <span className="text-[var(--color-text-2)]">{l}</span>
                <span className="text-right font-bold">{v}</span>
              </div>
            ))}
            {draft.description && (
              <p className="mt-2 whitespace-pre-wrap border-t border-[var(--color-border-card)] pt-2 text-[15px] text-[var(--color-text-2)]">
                {draft.description}
              </p>
            )}
          </div>
          <p className="rounded bg-[var(--color-surface-2)] p-3 text-[14px] leading-[1.6]">
            तुमचा नंबर फक्त लॉगिन केलेल्या खरेदीदारांनाच दिसेल.
          </p>
          <label className="flex items-start gap-2 text-[16px] leading-[1.6]">
            <input
              type="checkbox"
              className="mt-1"
              checked={declaration}
              onChange={(e) => setDeclaration(e.target.checked)}
            />
            <span>{DECLARATION}</span>
          </label>
          {!declaration && (
            <p className="text-[14px] text-[var(--color-text-2)]">
              हमीपत्र स्वीकारल्याशिवाय जाहिरात पाठवता येणार नाही
            </p>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="text-[14px] text-[var(--color-error)]">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 pt-4">
        {step < 5 ? (
          <Button
            onClick={next}
            loading={busy}
            disabled={
              (step === 1 && (!draft.species || !draft.breedId)) ||
              (step === 3 && photos.length < 3)
            }
          >
            पुढे जा
          </Button>
        ) : (
          <Button onClick={submit} loading={busy} disabled={!declaration}>
            तपासणीसाठी पाठवा
          </Button>
        )}
        {step === 3 && photos.length < 3 && (
          <p className="text-center text-[14px] text-[var(--color-text-2)]">
            पुढे जाण्यासाठी किमान ३ फोटो जोडा
          </p>
        )}
      </div>
    </div>
  )
}

export default function SellNewPage() {
  return (
    <AuthGate>
      <Container variant="form">
        <Suspense>
          <WizardInner />
        </Suspense>
      </Container>
    </AuthGate>
  )
}
