// StatusBadge — the 7 listing statuses (design tokens §Status badges). The
// Marathi label is ALWAYS present (never color alone — accessibility + the
// low-literacy rule). Colors come from the --status-*-bg/-fg token pairs.

import type { ListingStatus } from '@/lib/validation/common'

const STATUS: Record<ListingStatus, { labelMr: string; bg: string; fg: string }> = {
  DRAFT: { labelMr: 'अपूर्ण', bg: 'var(--status-draft-bg)', fg: 'var(--status-draft-fg)' },
  PENDING: { labelMr: 'तपासणीत', bg: 'var(--status-pending-bg)', fg: 'var(--status-pending-fg)' },
  APPROVED: { labelMr: 'चालू', bg: 'var(--status-approved-bg)', fg: 'var(--status-approved-fg)' },
  REJECTED: {
    labelMr: 'नाकारली',
    bg: 'var(--status-rejected-bg)',
    fg: 'var(--status-rejected-fg)',
  },
  SOLD: { labelMr: 'विकले गेले', bg: 'var(--status-sold-bg)', fg: 'var(--status-sold-fg)' },
  EXPIRED: {
    labelMr: 'मुदत संपली',
    bg: 'var(--status-expired-bg)',
    fg: 'var(--status-expired-fg)',
  },
  ARCHIVED: { labelMr: 'बंद', bg: 'var(--status-archived-bg)', fg: 'var(--status-archived-fg)' },
}

export function StatusBadge({ status }: { status: ListingStatus }) {
  const s = STATUS[status]
  return (
    <span
      className="inline-flex items-center rounded px-2 py-1 text-[14px] font-bold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.labelMr}
    </span>
  )
}
