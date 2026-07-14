'use client'

// S-11 My Listings — the seller hub (bottom-nav "विका"). Shows the active-listing
// quota meter, status filter tabs, and the seller's listings (the only place
// non-APPROVED own listings are visible, BR-034). "+ नवीन जाहिरात" opens the
// wizard. A submit success (?submitted=1) shows a confirmation banner.

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { AuthGate } from '@/components/auth/AuthGate'
import { Container } from '@/components/layout/Container'
import { Icon } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { apiFetch } from '@/lib/api/client'
import { formatInr } from '@/lib/utils/format'
import type { ListingStatus } from '@/lib/validation/common'

const TABS: Array<{ key: ListingStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'सर्व' },
  { key: 'APPROVED', label: 'चालू' },
  { key: 'PENDING', label: 'तपासणीत' },
  { key: 'DRAFT', label: 'अपूर्ण' },
  { key: 'REJECTED', label: 'नाकारली' },
  { key: 'SOLD', label: 'विकले' },
  { key: 'EXPIRED', label: 'मुदत संपली' },
]

const SPECIES_MR: Record<string, string> = {
  COW: 'गाय',
  BUFFALO: 'म्हैस',
  BULL_OX: 'बैल',
  GOAT: 'शेळी',
  SHEEP: 'मेंढी',
  REDA: 'रेडा',
}

type Item = {
  id: string
  species: string
  breed: { nameMr: string } | null
  priceInr: number | null
  village: string | null
  thumbnailUrl: string | null
  status: ListingStatus
  rejectionReason: string | null
  imageCount: number
}

function MyListingsInner() {
  const params = useSearchParams()
  const submitted = params.get('submitted') === '1'
  const [tab, setTab] = useState<ListingStatus | 'ALL'>('ALL')
  const [items, setItems] = useState<Item[] | null>(null)
  const [meta, setMeta] = useState<{ activeCount: number; activeLimit: number } | null>(null)
  const [error, setError] = useState(false)
  const [confirmingSold, setConfirmingSold] = useState<string | null>(null)
  const [soldBusy, setSoldBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Fetch inline as a cancellable async IIFE — the sets are all post-await, so
  // there is no synchronous setState in the effect body. Re-runs when tab OR
  // reloadKey changes (reloadKey bumps after a mark-as-sold to refresh the list).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const qs = tab === 'ALL' ? '' : `?status=${tab}`
        const res = await apiFetch(`/api/v1/users/me/listings${qs}`)
        if (cancelled) return
        if (!res.ok) throw new Error()
        const page = await res.json()
        if (cancelled) return
        setItems(page.items)
        setMeta(page.meta)
        setError(false)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, reloadKey])

  // Mark an APPROVED listing SOLD (T-06) so buyers stop contacting the seller.
  async function markSold() {
    const id = confirmingSold
    if (!id) return
    setSoldBusy(true)
    try {
      const res = await apiFetch(`/api/v1/listings/${id}/sold`, { method: 'POST' })
      if (res.ok) {
        setConfirmingSold(null)
        setItems(null) // skeleton while the refreshed list loads
        setReloadKey((k) => k + 1)
      }
    } catch {
      /* leave the dialog open so the user can retry */
    } finally {
      setSoldBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold">माझ्या जाहिराती</h1>
        {meta && (
          <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-[14px] font-bold text-[var(--color-text-2)]">
            {meta.activeCount} / {meta.activeLimit}
          </span>
        )}
      </header>

      {submitted && (
        <p
          role="status"
          className="rounded bg-[var(--color-success-bg)] p-3 text-[14px] text-[var(--color-success)]"
        >
          तुमची जाहिरात तपासणीसाठी पाठवली आहे. 24 तासांच्या आत उत्तर मिळेल.
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setItems(null) // show skeleton while the new tab loads (event handler, not an effect)
              setError(false)
              setTab(t.key)
            }}
            aria-pressed={tab === t.key}
            className={
              'min-h-[var(--touch-min)] shrink-0 rounded-full border px-4 text-[15px] font-bold ' +
              (tab === t.key
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'border-[var(--color-border-card)] text-[var(--color-text)]')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {items === null && !error && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {error && (
        <p role="alert" className="text-[var(--color-error)]">
          जाहिराती मिळाल्या नाहीत. इंटरनेट तपासा.
        </p>
      )}

      {items && items.length === 0 && (
        <EmptyState
          icon="sell"
          title="अजून एकही जाहिरात नाही. पहिली जाहिरात टाका."
          cta={
            <Link
              href="/sell/new"
              className="inline-flex min-h-[var(--h-button)] items-center rounded bg-[var(--color-primary)] px-5 font-bold text-[var(--color-on-primary)]"
            >
              नवीन जाहिरात
            </Link>
          }
        />
      )}

      {items && items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((l) => (
            <li
              key={l.id}
              className="overflow-hidden rounded-card border border-[var(--color-border-card)]"
            >
              <Link
                href={l.status === 'DRAFT' ? `/sell/new?id=${l.id}` : `/listings/${l.id}`}
                className="flex gap-3 p-2"
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-[var(--color-muted)]">
                  {l.thumbnailUrl ? (
                    <Image src={l.thumbnailUrl} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--color-text-3)]">
                      <Icon name="gallery" size={24} />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {l.breed?.nameMr ?? ''} {SPECIES_MR[l.species] ?? ''}
                    </span>
                    <StatusBadge status={l.status} />
                  </div>
                  {l.priceInr != null && (
                    <span className="text-[var(--color-primary)]">{formatInr(l.priceInr)}</span>
                  )}
                  {l.village && (
                    <span className="text-[14px] text-[var(--color-text-2)]">{l.village}</span>
                  )}
                  {l.status === 'REJECTED' && l.rejectionReason && (
                    <span className="text-[14px] text-[var(--color-error)]">
                      कारण: {l.rejectionReason}
                    </span>
                  )}
                </div>
              </Link>
              {(l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'REJECTED') && (
                <div className="flex gap-2 border-t border-[var(--color-border-card)] p-2">
                  <Link
                    href={`/sell/new?id=${l.id}`}
                    className="flex min-h-[var(--touch-min)] flex-1 items-center justify-center gap-1 rounded border border-[var(--color-primary)] text-[14px] font-bold text-[var(--color-primary)]"
                  >
                    <Icon name="edit" size={16} />
                    {l.status === 'REJECTED' ? 'बदला व पुन्हा पाठवा' : 'बदला'}
                  </Link>
                  {l.status === 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => setConfirmingSold(l.id)}
                      className="flex min-h-[var(--touch-min)] flex-1 items-center justify-center gap-1 rounded border border-[var(--color-border-card)] text-[14px] font-bold text-[var(--color-text-2)]"
                    >
                      <Icon name="check" size={16} />
                      विकले गेले
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* FAB rides a centered fixed track capped to the content column, so the pill
          sits at the column's right edge on desktop (identical to right-4 on phones,
          where max-w-3xl never binds). pointer-events-none lets taps pass through the
          invisible track to content behind it. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-3xl px-4">
        <Link
          href="/sell/new"
          className="pointer-events-auto ml-auto flex w-fit min-h-[var(--touch-min)] items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 font-bold text-[var(--color-on-primary)] shadow-card"
        >
          <Icon name="plus" size={20} />
          नवीन जाहिरात
        </Link>
      </div>

      <ConfirmDialog
        open={confirmingSold !== null}
        title="विकले म्हणून खूण करायचे?"
        message="ही जाहिरात 'विकले गेले' म्हणून दाखवली जाईल आणि खरेदीदार तुम्हाला संपर्क करणार नाहीत."
        confirmLabel="होय, विकले गेले"
        loading={soldBusy}
        onConfirm={markSold}
        onCancel={() => setConfirmingSold(null)}
      />
    </div>
  )
}

export default function MyListingsPage() {
  return (
    <AuthGate>
      <Container variant="wide">
        <Suspense>
          <MyListingsInner />
        </Suspense>
      </Container>
    </AuthGate>
  )
}
