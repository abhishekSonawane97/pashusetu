'use client'

// S-19/S-20 — moderation queue + review. Lists listings by status (PENDING is the
// FIFO review queue, BR-040); each card shows everything an admin needs to decide
// (photos, full attributes, seller with phone + history, SLA age, soft flags) and
// the two decisions: approve (API-26) or reject with a BR-043 reason (API-27).

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Icon } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatInr, ageMonthsToMr } from '@/lib/utils/format'
import { rejectionLabelMr, type RejectReason } from '@/lib/validation/admin'
import type { ListingStatus } from '@/lib/validation/common'

const SPECIES_MR: Record<string, string> = {
  COW: 'गाय',
  BUFFALO: 'म्हैस',
  BULL_OX: 'बैल',
  GOAT: 'शेळी',
  SHEEP: 'मेंढी',
}
const SEX_MR: Record<string, string> = { FEMALE: 'मादी', MALE: 'नर' }

const TABS: Array<{ key: ListingStatus; label: string }> = [
  { key: 'PENDING', label: 'तपासणीत' },
  { key: 'APPROVED', label: 'मंजूर' },
  { key: 'REJECTED', label: 'नाकारल्या' },
]

type Item = {
  id: string
  status: ListingStatus
  species: string
  breed: { nameMr: string } | null
  sex: string | null
  ageMonths: number | null
  milkYieldLpd: number | null
  isPregnant: boolean | null
  isVaccinated: boolean | null
  priceInr: number | null
  negotiable: boolean
  description: string | null
  district: { nameMr: string } | null
  taluka: string | null
  village: string | null
  images: Array<{ id: string; urls: { card: string; thumb: string } }>
  updatedAt: string
  seller: {
    name: string
    phone: string
    district: { nameMr: string } | null
    priorListingCount: number
    priorRejectionCount: number
  }
  moderation: {
    queueAgeHours: number | null
    possibleContactInfo: boolean
    duplicateOfListingId: string | null
    openReportCount: number
    rejectionCount: number
  }
}

// SLA badge (BR-041): ≥24 h red, ≥18 h amber, else neutral.
function slaBadge(hours: number | null) {
  if (hours == null) return null
  const h = Math.floor(hours)
  const label = h < 1 ? 'आत्ताच' : `${h} तास रांगेत`
  const cls =
    hours >= 24
      ? 'bg-[var(--status-rejected-bg)] text-[var(--status-rejected-fg)]'
      : hours >= 18
        ? 'bg-[var(--status-pending-bg)] text-[var(--status-pending-fg)]'
        : 'bg-[var(--color-surface-2)] text-[var(--color-text-2)]'
  return { label, cls }
}

export default function AdminQueuePage() {
  const [tab, setTab] = useState<ListingStatus>('PENDING')
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reject, setReject] = useState<{
    item: Item
    reason: RejectReason | null
    detail: string
  } | null>(null)

  // Fetch the queue for the active tab (cancellable IIFE — no sync setState).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(`/api/v1/admin/listings?status=${tab}`)
        if (cancelled) return
        if (!res.ok) throw new Error()
        const page = await res.json()
        if (cancelled) return
        setItems(page.items)
        setError(null)
      } catch {
        if (!cancelled) setError('रांग मिळाली नाही. पुन्हा प्रयत्न करा.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab])

  function drop(id: string) {
    setItems((cur) => (cur ? cur.filter((i) => i.id !== id) : cur))
  }

  async function approve(item: Item) {
    setBusyId(item.id)
    setError(null)
    try {
      const res = await apiFetch(`/api/v1/admin/listings/${item.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ expectedUpdatedAt: item.updatedAt }),
      })
      if (res.ok) return drop(item.id)
      const body = await res.json().catch(() => null)
      setError(
        body?.error?.details?.reason === 'STALE_REVIEW'
          ? 'विक्रेत्याने जाहिरात बदलली आहे. रांग पुन्हा उघडा.'
          : (body?.error?.message ?? 'मंजूर करता आले नाही.'),
      )
    } catch {
      setError('इंटरनेट नाही. पुन्हा प्रयत्न करा.')
    } finally {
      setBusyId(null)
    }
  }

  async function submitReject() {
    if (!reject || !reject.reason) return
    if (reject.reason === 'OTHER' && !reject.detail.trim()) return
    setBusyId(reject.item.id)
    setError(null)
    try {
      const res = await apiFetch(`/api/v1/admin/listings/${reject.item.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reject.reason,
          ...(reject.detail.trim() ? { detail: reject.detail.trim() } : {}),
          expectedUpdatedAt: reject.item.updatedAt,
        }),
      })
      if (res.ok) {
        drop(reject.item.id)
        setReject(null)
        return
      }
      const body = await res.json().catch(() => null)
      setError(body?.error?.message ?? 'नाकारता आले नाही.')
    } catch {
      setError('इंटरनेट नाही. पुन्हा प्रयत्न करा.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[22px] font-bold">तपासणी रांग</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setItems(null)
              setError(null)
              setTab(t.key)
            }}
            aria-pressed={tab === t.key}
            className={
              'min-h-[var(--touch-min)] shrink-0 rounded-full border px-4 text-[15px] font-bold ' +
              (tab === t.key
                ? 'border-[var(--color-dark)] bg-[var(--color-dark)] text-white'
                : 'border-[var(--color-border-card)] text-[var(--color-text)]')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded bg-[var(--status-rejected-bg)] p-3 text-[14px] text-[var(--status-rejected-fg)]"
        >
          {error}
        </p>
      )}

      {items === null && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      )}

      {items && items.length === 0 && (
        <EmptyState
          icon="check"
          title={tab === 'PENDING' ? 'रांग रिकामी आहे. सर्व तपासले!' : 'इथे काही नाही.'}
        />
      )}

      {items && items.length > 0 && (
        <ul className="flex flex-col gap-4">
          {items.map((l) => {
            const sla = slaBadge(l.moderation.queueAgeHours)
            return (
              <li
                key={l.id}
                className="flex flex-col gap-3 rounded-card border border-[var(--color-border-card)] bg-[var(--color-surface)] p-3 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[18px] font-bold">
                    {l.breed?.nameMr ?? ''} {SPECIES_MR[l.species] ?? l.species}
                  </span>
                  {tab === 'PENDING' && sla ? (
                    <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${sla.cls}`}>
                      {sla.label}
                    </span>
                  ) : (
                    <StatusBadge status={l.status} />
                  )}
                </div>

                {l.images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {l.images.map((img) => (
                      <div
                        key={img.id}
                        className="relative h-28 w-28 shrink-0 overflow-hidden rounded bg-[var(--color-muted)]"
                      >
                        <Image
                          src={img.urls.card}
                          alt=""
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-[var(--color-text-2)]">
                  {l.priceInr != null && (
                    <span className="font-bold text-[var(--color-primary)]">
                      {formatInr(l.priceInr)}
                    </span>
                  )}
                  {l.sex && <span>{SEX_MR[l.sex]}</span>}
                  {l.ageMonths != null && <span>{ageMonthsToMr(l.ageMonths)}</span>}
                  {l.milkYieldLpd != null && <span>{l.milkYieldLpd} लि/दिवस</span>}
                  {l.isPregnant && <span>गाभण</span>}
                  {l.isVaccinated && <span>लसीकरण ✓</span>}
                  {(l.village || l.district) && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="location" size={14} /> {l.village}
                      {l.district ? `, ${l.district.nameMr}` : ''}
                    </span>
                  )}
                </div>

                {l.description && <p className="text-[15px] leading-[1.6]">{l.description}</p>}

                {/* Soft flags (BR-029/065) — advisory, never block */}
                {(l.moderation.possibleContactInfo ||
                  l.moderation.duplicateOfListingId ||
                  l.moderation.openReportCount > 0) && (
                  <div className="flex flex-col gap-1 rounded bg-[var(--status-pending-bg)] p-2 text-[13px] text-[var(--status-pending-fg)]">
                    {l.moderation.possibleContactInfo && <span>⚠ वर्णनात फोन नंबर असू शकतो</span>}
                    {l.moderation.duplicateOfListingId && <span>⚠ हीच जाहिरात आधीच असू शकते</span>}
                    {l.moderation.openReportCount > 0 && (
                      <span>⚠ {l.moderation.openReportCount} तक्रारी</span>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-0.5 border-t border-[var(--color-border-card)] pt-2 text-[14px] text-[var(--color-text-2)]">
                  <span className="font-bold text-[var(--color-text)]">{l.seller.name}</span>
                  <a
                    href={`tel:${l.seller.phone}`}
                    className="inline-flex w-fit items-center gap-1 text-[var(--color-primary)]"
                  >
                    <Icon name="call" size={14} /> {l.seller.phone}
                  </a>
                  <span>
                    {l.seller.priorListingCount} जाहिराती · {l.seller.priorRejectionCount} नाकारल्या
                    {l.moderation.rejectionCount >= 3 && (
                      <span className="ml-2 rounded bg-[var(--status-rejected-bg)] px-2 py-0.5 font-bold text-[var(--status-rejected-fg)]">
                        वारंवार
                      </span>
                    )}
                  </span>
                </div>

                {tab === 'PENDING' && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="secondary"
                      loading={busyId === l.id}
                      onClick={() => setReject({ item: l, reason: null, detail: '' })}
                    >
                      नाकारा
                    </Button>
                    <Button variant="primary" loading={busyId === l.id} onClick={() => approve(l)}>
                      मंजूर करा
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <BottomSheet open={!!reject} onClose={() => setReject(null)} title="नाकारण्याचे कारण">
        <div className="flex flex-col gap-2">
          {(Object.keys(rejectionLabelMr) as RejectReason[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setReject((r) => (r ? { ...r, reason: code } : r))}
              aria-pressed={reject?.reason === code}
              className={
                'min-h-[var(--touch-min)] rounded border px-4 text-left text-[16px] ' +
                (reject?.reason === code
                  ? 'border-[var(--color-primary)] bg-[var(--color-surface-2)] font-bold'
                  : 'border-[var(--color-border-card)]')
              }
            >
              {rejectionLabelMr[code]}
            </button>
          ))}
          {reject?.reason === 'OTHER' && (
            <textarea
              value={reject.detail}
              onChange={(e) => setReject((r) => (r ? { ...r, detail: e.target.value } : r))}
              maxLength={500}
              rows={3}
              placeholder="कारण लिहा (विक्रेत्याला दिसेल)"
              className="rounded border border-[var(--color-border-input)] p-3 text-[16px]"
            />
          )}
          <Button
            variant="danger"
            loading={busyId === reject?.item.id}
            disabled={!reject?.reason || (reject?.reason === 'OTHER' && !reject.detail.trim())}
            onClick={submitReject}
          >
            जाहिरात नाकारा
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
