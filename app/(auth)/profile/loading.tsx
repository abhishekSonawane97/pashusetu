// Route-transition skeleton for the profile view/edit form (S-04). Form-width; a
// title + four labeled fields + a submit button, matching the profile layout.

import { Container } from '@/components/layout/Container'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <Container variant="form" className="px-4 py-6">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-8 w-1/2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[52px] w-full" />
          </div>
        ))}
        <Skeleton className="h-[52px] w-full" />
      </div>
    </Container>
  )
}
