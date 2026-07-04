// Regenerates components/ui/icons/paths.ts from design/icons/*.svg.
// Run after the designer drops new/updated icons: `node scripts/gen-icons.mjs`.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'design/icons'
const OUT = 'components/ui/icons/paths.ts'

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

const entries = readdirSync(SRC)
  .filter((f) => f.endsWith('.svg'))
  .sort()
  .map((f) => {
    const svg = readFileSync(join(SRC, f), 'utf8').trim()
    const inner = svg
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '')
      .replace(/\n/g, '')
      .trim()
    return [camel(f.slice(0, -4)), inner.replace(/\\/g, '\\\\').replace(/'/g, "\\'")]
  })

const body = [
  '// Auto-generated from design/icons/*.svg (Lucide-derived, 24px grid, currentColor).',
  '// Regenerate with `node scripts/gen-icons.mjs` after adding SVGs. Do not edit by hand.',
  'export const ICON_PATHS = {',
  ...entries.map(([k, v]) => `  '${k}': '${v}',`),
  '} as const',
  '',
  'export type IconName = keyof typeof ICON_PATHS',
  '',
].join('\n')

writeFileSync(OUT, body)
console.log(`Wrote ${OUT} with ${entries.length} icons`)
