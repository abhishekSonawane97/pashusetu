// BottomSheet — the login wall, filter panel, and confirmations use this
// (doc 06 §3.2: login wall is a cancellable sheet). Dismissible by backdrop tap,
// Escape, or the close button (doc 06 dead-end audit: overlays dismissible).
// Rounded top corners per tokens --radius-sheet; safe-area inset for standalone.
//
// Responsive (docs/10 §7.1): a bottom sheet on phones, a CENTERED modal capped at
// 480px on desktop (md+). All base classes are unchanged — the desktop form is
// added purely via md: variants — so the mobile sheet is byte-identical. On open
// it locks body scroll and traps focus (it is a real modal at md), restoring both
// on close.

'use client'

import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Lock background scroll while the overlay is up (prevents the page scrolling
    // behind the sheet/modal on both phones and desktop).
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog so keyboard/SR users start inside it.
    panelRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      // Trap Tab within the panel (it is aria-modal).
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!focusables || focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-t-[var(--radius-sheet)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] shadow-header outline-none md:flex md:max-h-[85vh] md:flex-col md:rounded-[var(--radius-sheet)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-card)] p-4 md:shrink-0">
          <h2 className="text-[20px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="बंद करा"
            className="flex min-h-[var(--touch-min)] min-w-[var(--touch-min)] items-center justify-center text-[var(--color-text-2)]"
          >
            <Icon name="close" size={24} title="बंद करा" />
          </button>
        </div>
        <div className="p-4 md:overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
