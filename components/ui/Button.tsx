// Button — design tokens §Component sizes (--h-button 52px), one filled primary
// action per screen (design hard rule 5). Variants: primary (filled), secondary
// (outline), ghost (text). Full-width by default (mobile-first). Loading state
// shows an inline spinner and disables (design hard rule 7: skeletons/spinners).

'use client'

import { cn } from '@/lib/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  loading?: boolean
  fullWidth?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded font-bold ' +
  'min-h-[var(--h-button)] px-5 text-[16px] leading-[1.6] ' +
  'transition-[background,opacity] duration-[var(--t-base)] ' +
  'disabled:bg-[var(--color-disabled-bg)] disabled:text-[var(--color-disabled-fg)] ' +
  'disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-[var(--color-primary)]'

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-primary)]',
  ghost: 'bg-transparent text-[var(--color-primary)]',
  danger: 'bg-[var(--color-error)] text-white',
}

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  )
}
