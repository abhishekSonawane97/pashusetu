// Route-transition skeleton for the browse/search results (S-06). Shown the instant
// a user navigates here, while the RSC shell loads — matches ListingGrid's grid so
// there is no layout shift when the real cards arrive.

import { Container } from '@/components/layout/Container'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <Container variant="wide" className="px-4 py-3">
      <Skeleton className="mb-4 h-11 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full" />
        ))}
      </div>
    </Container>
  )
}
