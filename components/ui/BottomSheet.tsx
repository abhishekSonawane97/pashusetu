// BottomSheet — the login wall, filter panel, and confirmations use this
// (doc 06 §3.2: login wall is a cancellable sheet). Dismissible by backdrop tap,
// Escape, or the close button (doc 06 dead-end audit: overlays dismissible).
// Rounded top corners per tokens --radius-sheet; safe-area inset for standalone.

'use client'

import { useEffect } from 'react'
import { Icon } from './Icon'

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
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-t-[var(--radius-sheet)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] shadow-header"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-card)] p-4">
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
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
