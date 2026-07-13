// SpeciesChips — the 5 species as filter entry points (S-05 → S-06). Icon +
// visible Marathi label (hard rule 5). Species icons are placeholders per the
// designer README ("Known gaps"); a neutral glyph stands in until they ship.

import Link from 'next/link'
import type { Species } from '@/lib/validation/common'

const SPECIES: Array<{ key: Species; label: string }> = [
  { key: 'COW', label: 'गाय' },
  { key: 'BUFFALO', label: 'म्हैस' },
  { key: 'BULL_OX', label: 'बैल' },
  { key: 'GOAT', label: 'शेळी' },
  { key: 'SHEEP', label: 'मेंढी' },
  { key: 'REDA', label: 'रेडा' },
]

export function SpeciesChips() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="जनावराचा प्रकार">
      {SPECIES.map((s) => (
        <Link
          key={s.key}
          role="listitem"
          href={`/listings?species=${s.key}`}
          className="flex min-h-[var(--touch-min)] shrink-0 items-center rounded-full border border-[var(--color-border-card)] bg-[var(--color-surface)] px-4 text-[16px] font-bold text-[var(--color-text)]"
        >
          {s.label}
        </Link>
      ))}
    </div>
  )
}
