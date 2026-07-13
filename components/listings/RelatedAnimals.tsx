// Related-animals shelves on the listing detail page (S-07) — horizontal,
// swipeable rows of ListingCards, the "similar products" pattern. A server
// component: the scroll is pure CSS (the SpeciesChips overflow-x idiom + scroll
// snap), so no client JS and the links are in the SSR HTML (good for SEO). Renders
// nothing when there are no shelves (e.g. a district with no other animals).

import Link from 'next/link'
import { ListingCard } from './ListingCard'
import type { RelatedSection } from '@/lib/api/types'

export function RelatedAnimals({ sections }: { sections: RelatedSection[] }) {
  if (!sections.length) return null
  return (
    <div className="flex flex-col gap-6 border-t border-[var(--color-border-card)] px-4 pt-6">
      {sections.map((section) => (
        <section key={section.key} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[18px] font-bold">{section.title}</h2>
            {section.seeAllHref && (
              <Link
                href={section.seeAllHref}
                className="shrink-0 text-[14px] font-bold text-[var(--color-primary)]"
              >
                सर्व पहा
              </Link>
            )}
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {section.items.map((item) => (
              <div key={item.id} className="w-[42vw] max-w-[190px] shrink-0 snap-start">
                <ListingCard listing={item} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
