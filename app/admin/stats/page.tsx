'use client'

// Admin analytics dashboard (NFR-10) — a snapshot of what's happening after launch.
// Admin-only: sits under app/admin (AdminGate + noindex), data from /admin/stats
// (requireAdmin). Read-only aggregates over listings / views / interest events.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { Skeleton } from '@/components/ui/Skeleton'

type Stats = {
  listings: { total: number; byStatus: Record<string, number>; newToday: number; newWeek: number }
  views: {
    total: number
    top: Array<{
      id: string
      viewCount: number
      species: string
      breedMr: string | null
      districtMr: string | null
    }>
  }
  interest: { call: number; whatsapp: number; interest: number; total: number; last7dTotal: number }
  zeroEnquiryApproved: number
  topDistricts: Array<{ nameMr: string; count: number }>
}

const SPECIES_MR: Record<string, string> = {
  COW: 'गाय',
  BUFFALO: 'म्हैस',
  BULL_OX: 'बैल',
  GOAT: 'शेळी',
  SHEEP: 'मेंढी',
  REDA: 'रेडा',
}
const STATUS_MR: Record<string, string> = {
  APPROVED: 'चालू',
  PENDING: 'तपासणीत',
  DRAFT: 'अपूर्ण',
  REJECTED: 'नाकारली',
  SOLD: 'विकले',
  EXPIRED: 'मुदत संपली',
  ARCHIVED: 'संग्रहित',
}

const card = 'rounded-card border border-[var(--color-border-card)] bg-[var(--color-surface)] p-4 shadow-card'

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className={card}>
      <p className="text-[28px] font-bold tabular-nums">{value}</p>
      <p className="text-[14px] text-[var(--color-text-2)]">{label}</p>
      {hint && <p className="mt-1 text-[12px] text-[var(--color-text-3)]">{hint}</p>}
    </div>
  )
}

function Row({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <>
      <span className="text-[var(--color-text-2)]">{label}</span>
      <span className="font-bold tabular-nums text-[var(--color-text)]">{value}</span>
    </>
  )
  const cls = 'flex justify-between gap-3 border-b border-[var(--color-border-card)] py-1.5 text-[14px]'
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/admin/stats')
        if (cancelled) return
        if (!res.ok) throw new Error()
        setStats(await res.json())
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error)
    return (
      <p role="alert" className="text-[var(--color-error)]">
        आकडेवारी मिळाली नाही. पुन्हा प्रयत्न करा.
      </p>
    )
  if (!stats)
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[22px] font-bold">आकडेवारी</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="एकूण जाहिराती" value={stats.listings.total} />
        <Tile label="चालू (मंजूर)" value={stats.listings.byStatus.APPROVED ?? 0} />
        <Tile label="आज नवीन" value={stats.listings.newToday} />
        <Tile label="या आठवड्यात नवीन" value={stats.listings.newWeek} />
        <Tile label="एकूण व्ह्यूज" value={stats.views.total} hint="मंजूर जाहिरातींवर" />
        <Tile
          label="एकूण संपर्क"
          value={stats.interest.total}
          hint={`गेल्या ७ दिवसांत ${stats.interest.last7dTotal}`}
        />
      </div>

      <section className={card}>
        <h2 className="mb-3 text-[16px] font-bold">संपर्क प्रकार</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[22px] font-bold tabular-nums">{stats.interest.call}</p>
            <p className="text-[13px] text-[var(--color-text-2)]">कॉल</p>
          </div>
          <div>
            <p className="text-[22px] font-bold tabular-nums">{stats.interest.whatsapp}</p>
            <p className="text-[13px] text-[var(--color-text-2)]">WhatsApp</p>
          </div>
          <div>
            <p className="text-[22px] font-bold tabular-nums">{stats.interest.interest}</p>
            <p className="text-[13px] text-[var(--color-text-2)]">आवड</p>
          </div>
        </div>
        <p className="mt-3 text-[14px] text-[var(--color-text-2)]">
          <span className="font-bold text-[var(--color-error)]">{stats.zeroEnquiryApproved}</span>{' '}
          मंजूर जाहिरातींना अजून एकही संपर्क नाही
        </p>
      </section>

      <section className={card}>
        <h2 className="mb-3 text-[16px] font-bold">स्थितीनुसार</h2>
        <div className="flex flex-col">
          {Object.entries(stats.listings.byStatus).map(([s, n]) => (
            <Row key={s} label={STATUS_MR[s] ?? s} value={n} />
          ))}
        </div>
      </section>

      {stats.views.top.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 text-[16px] font-bold">सर्वाधिक पाहिलेल्या</h2>
          <div className="flex flex-col">
            {stats.views.top.map((t) => (
              <Row
                key={t.id}
                href={`/listings/${t.id}`}
                label={`${t.breedMr ?? ''} ${SPECIES_MR[t.species] ?? ''}${t.districtMr ? ` · ${t.districtMr}` : ''}`}
                value={t.viewCount}
              />
            ))}
          </div>
        </section>
      )}

      {stats.topDistricts.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 text-[16px] font-bold">जिल्ह्यानुसार (चालू जाहिराती)</h2>
          <div className="flex flex-col">
            {stats.topDistricts.map((d) => (
              <Row key={d.nameMr} label={d.nameMr} value={d.count} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
