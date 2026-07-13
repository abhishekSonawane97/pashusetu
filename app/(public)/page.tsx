// S-05 home — browse entry: brand header, search-tap to filters, species chips,
// and the latest APPROVED listings. Public (BR-060). The search bar opens the
// structured-filter sheet IN PLACE (no page jump — F-12).

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SpeciesChips } from '@/components/listings/SpeciesChips'
import { HomeSearchBar } from '@/components/listings/HomeSearchBar'
import { HeroSlider } from '@/components/listings/HeroSlider'
import { NearbyListingGrid } from '@/components/listings/NearbyListingGrid'
import { AppMenu } from '@/components/layout/AppMenu'
import { Skeleton } from '@/components/ui/Skeleton'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'

// Home inherits the root title + alternates (canonical '/' + hreflang); it only
// overrides the description. This is the primary SEO landing page. (Not setting
// `alternates` here on purpose — doing so would replace the root's hreflang.)
export const metadata: Metadata = {
  description:
    'महाराष्ट्रातील गाय, म्हैस, बैल, शेळी, मेंढी थेट शेतकऱ्यांकडून खरेदी करा किंवा विका. मोफत जाहिरात, विश्वासू बाजार.',
}

export default function HomePage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      {/* Notifications (bell → /notifications) deferred to the notifications epic;
          hidden until built so it doesn't 404. Re-add when NTF ships. */}
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-[26px] font-bold text-[var(--color-primary)]">पशुसेतू</h1>
        <AppMenu />
      </header>

      {/* Featured animals showcase (S-05) — full-bleed 50vh slider above the feed. */}
      <HeroSlider />

      {/* Filter zone: search entry + species chips. Sticks to the top on scroll so
          filtering is always reachable (opaque bg so the feed scrolls under it). */}
      <div className="sticky top-0 z-30 -mx-4 flex flex-col gap-3 border-b border-[var(--color-border-card)] bg-[var(--color-surface)] px-4 py-3">
        <Suspense
          fallback={
            <div className="min-h-[var(--h-input)] rounded border border-[var(--color-border-input)] bg-[var(--color-surface-2)]" />
          }
        >
          <HomeSearchBar />
        </Suspense>

        <SpeciesChips />
      </div>

      <h2 className="mt-2 text-[20px] font-bold">नवीन जाहिराती</h2>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full" />
            ))}
          </div>
        }
      >
        <NearbyListingGrid />
      </Suspense>
      <InstallPrompt />
    </main>
  )
}
