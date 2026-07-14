// Home-feed wrapper that makes a logged-in user's feed default to their district
// ("nearby animals") — reusing the existing districtId filter, no new query logic.
// Logged-out users, or users without a district, get the normal latest feed. URL
// filters on /listings are unaffected (this only seeds the home page's default).

'use client'

import Link from 'next/link'
import { useMe } from '@/lib/api/use-me'
import { Skeleton } from '@/components/ui/Skeleton'
import { ListingGrid } from './ListingGrid'

export function NearbyListingGrid() {
  const { profile, loading } = useMe()

  // Wait for the profile to resolve before choosing district-vs-latest. Otherwise
  // the grid first mounts with the latest feed (profile still null), then remounts
  // to the district feed when it loads — swapping the animals under the user on a
  // slow phone (Home #1). Show a stable skeleton until we know which feed to mount.
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full" />
        ))}
      </div>
    )
  }

  const districtId = profile?.districtId ?? undefined
  if (!districtId) return <ListingGrid />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] text-[var(--color-text-2)]">
          {profile?.district?.nameMr
            ? `${profile.district.nameMr} मधील जनावरे`
            : 'तुमच्या जिल्ह्यातील जनावरे'}
        </span>
        <Link
          href="/listings"
          className="shrink-0 text-[14px] font-bold text-[var(--color-primary)]"
        >
          सर्व जनावरे पहा
        </Link>
      </div>
      <ListingGrid defaultDistrictId={districtId} />
    </div>
  )
}
