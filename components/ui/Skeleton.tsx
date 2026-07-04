// Skeleton — design hard rule 7: skeletons over spinners for anything >300ms,
// with explicit dimensions (zero CLS). Plain shimmer block.

import { cn } from '@/lib/utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-[var(--color-muted)]', className)} aria-hidden />
  )
}
