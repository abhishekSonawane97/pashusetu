// FilterSheet — S-06 filter panel (doc 06 Flow E). Species, district, price
// range and sort; applies by pushing URL params (shareable state, F-04 AC-6),
// which ListingGrid reacts to. Client-side minPrice<=maxPrice guard blocks the
// bad request before it is sent (F-04 AC-4).

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { apiFetch } from '@/lib/api/client'
import type { DistrictRef } from '@/lib/api/types'
import type { Species } from '@/lib/validation/common'

const SPECIES: Array<{ key: Species; label: string }> = [
  { key: 'COW', label: 'गाय' },
  { key: 'BUFFALO', label: 'म्हैस' },
  { key: 'BULL_OX', label: 'बैल' },
  { key: 'GOAT', label: 'शेळी' },
  { key: 'SHEEP', label: 'मेंढी' },
]

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // The form is (re)mounted fresh each time the sheet opens (key below), so its
  // controls initialize from the current URL via useState initializers — no
  // hydration effect, no synchronous setState-in-effect.
  const params = useSearchParams()
  return (
    <BottomSheet open={open} onClose={onClose} title="फिल्टर">
      {open && <FilterForm key={params.toString()} onClose={onClose} />}
    </BottomSheet>
  )
}

function FilterForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const params = useSearchParams()

  const [species, setSpecies] = useState<string>(() => params.get('species') ?? '')
  const [districtId, setDistrictId] = useState(() => params.get('districtId') ?? '')
  const [taluka, setTaluka] = useState(() => params.get('taluka') ?? '')
  const [minPrice, setMinPrice] = useState(() => params.get('minPrice') ?? '')
  const [maxPrice, setMaxPrice] = useState(() => params.get('maxPrice') ?? '')
  const [sort, setSort] = useState(() => params.get('sort') ?? 'newest')
  const [districts, setDistricts] = useState<DistrictRef[]>([])
  const [talukas, setTalukas] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/api/v1/meta/districts')
      .then((r) => r.json())
      .then((d) => setDistricts(d.items ?? []))
      .catch(() => {})
  }, [])

  // Talukas depend on the chosen district — refetch when it changes (and on open).
  useEffect(() => {
    const qs = districtId ? `?districtId=${encodeURIComponent(districtId)}` : ''
    apiFetch(`/api/v1/meta/talukas${qs}`)
      .then((r) => r.json())
      .then((d) => setTalukas(d.items ?? []))
      .catch(() => {})
  }, [districtId])

  function apply() {
    const min = minPrice ? Number(minPrice) : null
    const max = maxPrice ? Number(maxPrice) : null
    if (min != null && max != null && min > max) {
      setError('किमान किंमत जास्तीत जास्त किंमतीपेक्षा कमी हवी')
      return
    }
    const next = new URLSearchParams()
    if (species) next.set('species', species)
    if (districtId) next.set('districtId', districtId)
    if (taluka) next.set('taluka', taluka)
    if (min != null) next.set('minPrice', String(min))
    if (max != null) next.set('maxPrice', String(max))
    if (sort !== 'newest') next.set('sort', sort)
    router.push(`/listings?${next.toString()}`)
    onClose()
  }

  function clearAll() {
    router.push('/listings')
    onClose()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-[16px] font-bold">जनावराचा प्रकार</span>
        <div className="flex flex-wrap gap-2">
          {SPECIES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSpecies(species === s.key ? '' : s.key)}
              aria-pressed={species === s.key}
              className={
                'min-h-[var(--touch-min)] rounded-full border px-4 text-[16px] font-bold ' +
                (species === s.key
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                  : 'border-[var(--color-border-card)] text-[var(--color-text)]')
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <SelectField
        label="जिल्हा"
        value={districtId}
        onChange={(e) => {
          setDistrictId(e.target.value)
          setTaluka('') // taluka list changes with district — reset the selection
        }}
      >
        <option value="">सर्व जिल्हे</option>
        {districts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nameMr}
          </option>
        ))}
      </SelectField>

      <SelectField label="तालुका" value={taluka} onChange={(e) => setTaluka(e.target.value)}>
        <option value="">सर्व तालुके</option>
        {talukas.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </SelectField>

      <div className="flex gap-3">
        <TextField
          label="किमान किंमत"
          type="number"
          inputMode="numeric"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <TextField
          label="जास्तीत जास्त"
          type="number"
          inputMode="numeric"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
      </div>

      <SelectField label="क्रमवारी" value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="newest">नवीन आधी</option>
        <option value="price_asc">कमी किंमत आधी</option>
        <option value="price_desc">जास्त किंमत आधी</option>
      </SelectField>

      {error && (
        <p role="alert" className="text-[14px] text-[var(--color-error)]">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button onClick={apply}>जाहिराती पहा</Button>
        <Button variant="ghost" onClick={clearAll}>
          सर्व काढा
        </Button>
      </div>
    </div>
  )
}
