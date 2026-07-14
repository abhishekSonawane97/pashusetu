'use client'

// Admin feedback inbox (NFR-10). Read + triage the app-feedback / problem reports
// submitted from the menu. Admin-only: under app/admin (AdminGate + noindex), data
// from /admin/feedback (requireAdmin). Filter by status; "पूर्ण झाले" marks an item
// DONE (PATCH) and drops it from the unhandled view.

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

type FeedbackStatus = 'NEW' | 'SEEN' | 'DONE'
type FeedbackItem = {
  id: string
  type: 'PROBLEM' | 'SUGGESTION' | 'OTHER'
  message: string
  contact: string | null
  path: string | null
  status: FeedbackStatus
  createdAt: string
  user: { id: string; name: string; phone: string } | null
}

const TABS: { key: string; label: string; status?: FeedbackStatus }[] = [
  { key: 'NEW', label: 'नवीन', status: 'NEW' },
  { key: 'DONE', label: 'पूर्ण', status: 'DONE' },
  { key: 'ALL', label: 'सर्व' },
]
const TYPE_MR: Record<string, string> = { PROBLEM: 'अडचण', SUGGESTION: 'सूचना', OTHER: 'इतर' }
const STATUS_MR: Record<string, string> = { NEW: 'नवीन', SEEN: 'पाहिले', DONE: 'पूर्ण' }

const card = 'rounded-card border border-[var(--color-border-card)] bg-[var(--color-surface)] p-4 shadow-card'

function typeBadge(t: string) {
  const base = 'rounded bg-[var(--color-surface-2)] px-2 py-0.5 text-[12px] font-bold '
  if (t === 'PROBLEM') return base + 'text-[var(--color-error)]'
  if (t === 'SUGGESTION') return base + 'text-[var(--color-primary)]'
  return base + 'text-[var(--color-text-2)]'
}

function fmtPhone(e164: string): string {
  const d = e164.replace(/^\+91/, '')
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : e164
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'आत्ताच'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} मिनिटांपूर्वी`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} तासांपूर्वी`
  return `${Math.floor(h / 24)} दिवसांपूर्वी`
}

export default function AdminFeedbackPage() {
  const [tab, setTab] = useState<string>('NEW')
  const [items, setItems] = useState<FeedbackItem[] | null>(null)
  const [newCount, setNewCount] = useState(0)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError(false)
    void (async () => {
      try {
        const status = TABS.find((t) => t.key === tab)?.status
        const res = await apiFetch(`/api/v1/admin/feedback${status ? `?status=${status}` : ''}`)
        if (cancelled) return
        if (!res.ok) throw new Error()
        const data = await res.json()
        setItems(data.items)
        setNewCount(data.newCount)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab])

  async function markDone(id: string) {
    setBusyId(id)
    try {
      const res = await apiFetch(`/api/v1/admin/feedback/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'DONE' }),
      })
      if (!res.ok) throw new Error()
      // Drop from the unhandled view; update in place elsewhere. Keep the NEW badge honest.
      setItems((cur) =>
        cur == null
          ? cur
          : tab === 'NEW'
            ? cur.filter((f) => f.id !== id)
            : cur.map((f) => (f.id === id ? { ...f, status: 'DONE' } : f)),
      )
      setNewCount((c) => Math.max(0, c - 1))
    } catch {
      setError(true)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[22px] font-bold">
        अभिप्राय {newCount > 0 && <span className="text-[var(--color-error)]">({newCount} नवीन)</span>}
      </h1>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={
              'min-h-[40px] rounded px-4 text-[14px] font-bold ' +
              (tab === t.key
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border-card)]')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-[var(--color-error)]">
          काहीतरी चुकले. पुन्हा प्रयत्न करा.
        </p>
      )}

      {items == null && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {items != null && items.length === 0 && (
        <p className="py-8 text-center text-[var(--color-text-2)]">इथे अजून काही नाही.</p>
      )}

      {items != null && items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((f) => (
            <li key={f.id} className={card}>
              <div className="flex items-center justify-between gap-2">
                <span className={typeBadge(f.type)}>{TYPE_MR[f.type] ?? f.type}</span>
                <span className="text-[12px] text-[var(--color-text-3)]">{ago(f.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-[15px] text-[var(--color-text)]">
                {f.message}
              </p>
              <div className="mt-2 flex flex-col gap-0.5 text-[13px] text-[var(--color-text-2)]">
                {f.contact && <p>संपर्क: {f.contact}</p>}
                <p>
                  {f.user ? `${f.user.name} · ${fmtPhone(f.user.phone)}` : 'अनामिक'}
                  {f.path ? ` · ${f.path}` : ''}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[12px] text-[var(--color-text-3)]">{STATUS_MR[f.status] ?? f.status}</span>
                {f.status !== 'DONE' && (
                  <Button variant="secondary" loading={busyId === f.id} onClick={() => markDone(f.id)}>
                    पूर्ण झाले
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
