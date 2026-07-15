// Route-transition skeleton for the seller area (My Listings S-11 + wizard S-10).
// Generic stacked-card shimmer so it reads well for both the list and the wizard.

import { Container } from '@/components/layout/Container'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <Container variant="wide" className="px-4 py-4">
      <Skeleton className="mb-4 h-8 w-1/2" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-card border border-[var(--color-border-card)] bg-[var(--color-surface)] p-3"
          >
            <Skeleton className="h-20 w-24 shrink-0 rounded" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  )
}
