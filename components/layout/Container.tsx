// Content-width container — the single source of truth for the app's responsive
// column widths (docs/10-frontend-design-requirements/README.md §7.1). Width +
// centering ONLY (no padding — pages/layouts own their edge padding), so mobile
// stays byte-identical: the base cap is the current 448/672, widened purely via
// md:/lg: variants that are inert below the breakpoint.
//
//   wide  — home, browse, detail, My Listings: 448 → 768 at md (the §7 content cap)
//   form  — login, profile, wizard: 448 at all widths (forms stay ≤480, §7.1)
//   admin — moderation queue: 672 → 1280 at lg (desktop-first canvas, §7.1)

import { cn } from '@/lib/utils/cn'

const WIDTHS = {
  wide: 'max-w-md md:max-w-3xl',
  form: 'max-w-md',
  admin: 'max-w-2xl lg:max-w-7xl',
} as const

export function Container({
  variant = 'wide',
  className,
  children,
}: {
  variant?: keyof typeof WIDTHS
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('mx-auto w-full', WIDTHS[variant], className)}>{children}</div>
}
