// WhatsApp deep-link builder (BR-063). The canonical wa.me link + Marathi prefill
// are built SERVER-SIDE only (inside the API-21 reveal) so the seller phone never
// transits the client on its own — the number lives solely in the interest
// response (BR-062/066). Format: https://wa.me/<E.164 digits, no +>?text=<enc>.

import type { Species } from '@/lib/validation/common'

// Species → Marathi (shared with the listing card / detail labels).
const SPECIES_MR: Record<Species, string> = {
  COW: 'गाय',
  BUFFALO: 'म्हैस',
  BULL_OX: 'बैल',
  GOAT: 'शेळी',
  SHEEP: 'मेंढी',
}

export function speciesMr(species: Species): string {
  return SPECIES_MR[species]
}

type Prefill = {
  speciesMr: string
  breedMr: string
  priceInr: number
  listingUrl: string
}

/**
 * Canonical BR-063 Marathi prefill. Carries animal + price + listing URL only —
 * never a phone number or any other concealed field.
 */
export function whatsappPrefill({ speciesMr, breedMr, priceInr, listingUrl }: Prefill): string {
  const price = `₹${priceInr.toLocaleString('en-IN')}`
  return (
    `नमस्कार! मी PashuSetu वर तुमची जाहिरात पाहिली — ${breedMr} ${speciesMr}, ${price}. ` +
    `जनावर अजून विक्रीसाठी आहे का? जाहिरात: ${listingUrl}`
  )
}

/**
 * Build the wa.me deep link for an E.164 phone (e.g. "+919876543210").
 * Strips the leading "+" (and any non-digits) per the wa.me spec and appends the
 * URL-encoded Marathi prefill.
 */
export function buildWhatsappUrl(phoneE164: string, prefill: Prefill): string {
  const digits = phoneE164.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(whatsappPrefill(prefill))}`
}
