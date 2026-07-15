// Skeleton — design hard rule 7: skeletons over spinners for anything >300ms,
// with explicit dimensions (zero CLS). A lighter band sweeps across the muted base
// (real shimmer, not a flat pulse) so a loading screen reads as "working", not stuck.

import { cn } from '@/lib/utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('relative overflow-hidden rounded bg-[var(--color-muted)]', className)}
      aria-hidden
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
}
