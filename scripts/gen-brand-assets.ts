// scripts/gen-brand-assets.ts — regenerates the PWA icon set + default OG image
// from the «पशुसेतू» wordmark on brand pink (#C2185B). These are BRANDED
// PLACEHOLDERS — swap them (or this script's design) when the designer delivers
// the real logo, then re-run. Run from the repo root:
//   node --import tsx scripts/gen-brand-assets.ts
//
// Uses sharp's SVG rasterizer; Devanagari is rendered via the system
// "Lohit Devanagari" font (verified present via fc-list).

import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const PINK = '#C2185B'
const FONT = 'Lohit Devanagari, Kalimati, sans-serif'
const ICONS_DIR = 'public/icons'

// Square icon SVG. `contentScale` shrinks the wordmark for maskable safe-zone
// padding (maskable art must sit within the inner ~80%).
function iconSvg(size: number, contentScale: number): Buffer {
  const fontSize = Math.round(size * 0.2 * contentScale)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${PINK}"/>
  <text x="50%" y="50%" font-family="${FONT}" font-size="${fontSize}" font-weight="700" fill="#FFFFFF" text-anchor="middle" dominant-baseline="central">पशुसेतू</text>
</svg>`
  return Buffer.from(svg)
}

// 1200×630 social share card: wordmark + tagline.
function ogSvg(): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PINK}"/>
  <text x="600" y="290" font-family="${FONT}" font-size="150" font-weight="700" fill="#FFFFFF" text-anchor="middle">पशुसेतू</text>
  <text x="600" y="400" font-family="${FONT}" font-size="52" fill="#FFFFFF" fill-opacity="0.9" text-anchor="middle">महाराष्ट्रातील विश्वासू पशुधन बाजार</text>
</svg>`
  return Buffer.from(svg)
}

async function png(svg: Buffer, out: string) {
  await sharp(svg, { density: 384 }).png().toFile(out)
  console.log('  wrote', out)
}

async function main() {
  mkdirSync(ICONS_DIR, { recursive: true })
  // "any" icons — wordmark near full; still comfortably inside the frame.
  await png(iconSvg(512, 1), `${ICONS_DIR}/icon-512.png`)
  await png(iconSvg(192, 1), `${ICONS_DIR}/icon-192.png`)
  // maskable — extra padding so the wordmark survives the OS circular/rounded mask.
  await png(iconSvg(512, 0.72), `${ICONS_DIR}/maskable-512.png`)
  await png(iconSvg(192, 0.72), `${ICONS_DIR}/maskable-192.png`)
  // iOS home-screen icon.
  await png(iconSvg(180, 1), 'app/apple-icon.png')
  // Default OG/share card.
  await png(ogSvg(), 'public/og-default.png')
  console.log('Brand assets generated (branded placeholders — swap when the real logo lands).')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
