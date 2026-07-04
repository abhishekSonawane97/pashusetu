// EmptyState — every empty state has a CTA (doc 06 dead-end audit invariant).
// Illustration slots are placeholders until the designer ships them (README
// "Known gaps"); an icon stands in for now.

import { Icon, type IconName } from './Icon'

export function EmptyState({
  icon = 'search',
  title,
  cta,
}: {
  icon?: IconName
  title: string
  cta?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="text-[var(--color-text-3)]">
        <Icon name={icon} size={48} />
      </div>
      <p className="text-[18px] leading-[1.6] text-[var(--color-text-2)]">{title}</p>
      {cta}
    </div>
  )
}
