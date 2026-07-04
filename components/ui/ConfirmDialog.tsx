// ConfirmDialog — design hard rule 8: nothing irreversible without a plain-Marathi
// confirmation that NAMES the consequence (mark-sold, archive, logout, admin ban).
// Built on BottomSheet; the confirm button carries the consequence-aware variant.

'use client'

import { BottomSheet } from './BottomSheet'
import { Button } from './Button'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'रद्द करा',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onCancel} title={title}>
      <div className="flex flex-col gap-5">
        <p className="text-[18px] leading-[1.6] text-[var(--color-text)]">{message}</p>
        <div className="flex flex-col gap-3">
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
