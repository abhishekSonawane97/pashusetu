// Route-transition skeleton for a listing detail (S-05). This is the biggest win:
// the detail page renders server-side WITH the DB fetch, so tapping a card used to
// sit on the old screen for seconds. Now a shimmer of the detail layout appears
// instantly. The fixed contact bar is owned by the page; not mirrored here.

import { Container } from '@/components/layout/Container'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <Container variant="wide" className="px-4 py-3">
      <Skeleton className="aspect-[4/3] w-full rounded-card" />
      <div className="mt-4 flex flex-col gap-3">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="mt-1 flex gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </Container>
  )
}
