// S-07 listing detail — SSR for SEO (doc 08 API-07, F-05). Renders the full
// read view: photo carousel, price, all present attributes (unset ones OMITTED
// entirely — hard rule 3), description, seller card, and the SOLD/unavailable
// banners. The login-walled contact bar (call / WhatsApp / interest, API-21) and
// the favorite heart (API-19) arrive with the contact + favorites slices.

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AppError } from '@/lib/errors/app-error'
import * as listingService from '@/lib/services/listing-service'
import { PhotoCarousel } from '@/components/listings/PhotoCarousel'
import { ListingJsonLd } from '@/components/listings/ListingJsonLd'
import { Icon } from '@/components/ui/Icon'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pashusetu.in'
import { ageMonthsToMr, formatInr, timeSinceMr } from '@/lib/utils/format'
import type { Species } from '@/lib/validation/common'

export const dynamic = 'force-dynamic'

const SPECIES_MR: Record<Species, string> = {
  COW: 'गाय',
  BUFFALO: 'म्हैस',
  BULL_OX: 'बैल',
  GOAT: 'शेळी',
  SHEEP: 'मेंढी',
}

// The public detail (anonymous viewer) — the RSC render is always public;
// favorite/owner state is layered on client-side (contact/favorites slices).
async function loadPublicDetail(id: string) {
  try {
    return { detail: await listingService.getDetail(id, null), state: 'ok' as const }
  } catch (e) {
    if (e instanceof AppError && e.code === 'LISTING_NOT_FOUND') {
      const publicState = (e.details?.publicState as string) ?? null
      if (publicState === 'SOLD') return { detail: null, state: 'sold' as const }
      if (publicState === 'UNAVAILABLE') return { detail: null, state: 'unavailable' as const }
    }
    return { detail: null, state: 'notfound' as const }
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { detail } = await loadPublicDetail(id)
  if (!detail) return { title: 'पशुसेतू' }
  const d = detail as Record<string, unknown>
  const breed = (d.breed as { nameMr: string }).nameMr
  const title = `${breed} ${SPECIES_MR[d.species as Species]} — ${formatInr(d.priceInr as number)} | पशुसेतू`
  return { title, description: (d.description as string)?.slice(0, 160) }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--color-border-card)] py-2">
      <span className="text-[var(--color-text-2)]">{label}</span>
      <span className="font-bold text-[var(--color-text)]">{value}</span>
    </div>
  )
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { detail, state } = await loadPublicDetail(id)

  if (state === 'notfound') notFound()

  if (state === 'sold' || state === 'unavailable') {
    return (
      <main className="flex flex-col items-center gap-4 p-8 text-center">
        <Icon name={state === 'sold' ? 'check' : 'clock'} size={48} />
        <p className="text-[20px] font-bold">
          {state === 'sold' ? 'हे जनावर विकले गेले आहे' : 'ही जाहिरात आता उपलब्ध नाही'}
        </p>
      </main>
    )
  }

  const d = detail as Record<string, unknown>
  const breed = d.breed as { nameMr: string }
  const species = d.species as Species
  const district = d.district as { nameMr: string }
  const seller = d.seller as { firstName: string; memberSince: string; activeListingCount: number }
  const images = d.images as Array<{ id: string; urls: { detail: string } }>
  const title = `${breed.nameMr} ${SPECIES_MR[species]}`

  return (
    <main className="pb-24">
      <ListingJsonLd
        id={d.id as string}
        title={title}
        description={d.description as string | null}
        priceInr={d.priceInr as number}
        imageUrl={images[0]?.urls.detail ?? null}
        status={d.status as string}
        baseUrl={BASE_URL}
      />
      <PhotoCarousel photos={images} alt={title} />

      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-[26px] font-bold text-[var(--color-primary)]">
            {formatInr(d.priceInr as number)}
            {(d.negotiable as boolean) && (
              <span className="ml-2 align-middle text-[16px] font-normal text-[var(--color-text-2)]">
                बोलणी होऊ शकते
              </span>
            )}
          </p>
          <h1 className="mt-1 text-[22px] font-bold">{title}</h1>
          <p className="flex items-center gap-1 text-[16px] text-[var(--color-text-2)]">
            <Icon name="location" size={16} />
            {d.village as string}, {district.nameMr}
          </p>
          <p className="mt-1 text-[14px] text-[var(--color-text-3)]">
            {timeSinceMr(d.approvedAt as string)} · {d.viewCount as number} वेळा पाहिली
          </p>
        </div>

        {/* Attributes — each row only when the value is present (hard rule 3). */}
        <section className="rounded-card border border-[var(--color-border-card)] p-3">
          <InfoRow label="वय" value={ageMonthsToMr(d.ageMonths as number)} />
          {d.milkYieldLpd != null && (d.milkYieldLpd as number) > 0 && (
            <InfoRow label="दूध उत्पादन" value={`${d.milkYieldLpd as number} लिटर/दिवस`} />
          )}
          {d.lactationNumber != null && (d.lactationNumber as number) > 0 && (
            <InfoRow label="वेत" value={`${d.lactationNumber as number}`} />
          )}
          {d.weightKg != null && <InfoRow label="वजन" value={`${d.weightKg as number} किलो`} />}
          {d.isPregnant === true && <InfoRow label="गाभण" value="होय" />}
          {d.isVaccinated === true && <InfoRow label="लसीकरण" value="झाले आहे" />}
        </section>

        {d.description != null && (
          <section>
            <h2 className="mb-1 text-[18px] font-bold">माहिती</h2>
            <p className="whitespace-pre-wrap text-[16px] leading-[1.6] text-[var(--color-text)]">
              {d.description as string}
            </p>
          </section>
        )}

        <section className="rounded-card border border-[var(--color-border-card)] p-3">
          <h2 className="mb-2 text-[18px] font-bold">विक्रेता</h2>
          <p className="text-[16px] font-bold">{seller.firstName}</p>
          <p className="text-[14px] text-[var(--color-text-2)]">
            {district.nameMr} · सदस्य {seller.memberSince} पासून · {seller.activeListingCount}{' '}
            जाहिराती
          </p>
        </section>
      </div>
    </main>
  )
}
