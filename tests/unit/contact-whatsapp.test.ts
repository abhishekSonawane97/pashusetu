// Unit — the BR-063 WhatsApp deep-link builder. The link + prefill are built
// server-side (never on the client, BR-066); these assertions pin the canonical
// format so a refactor can't silently change what sellers receive or leak a phone.
import { describe, expect, it } from 'vitest'
import { buildWhatsappUrl, whatsappPrefill, speciesMr } from '@/lib/contact/whatsapp'

const prefill = {
  speciesMr: 'गाय',
  breedMr: 'गीर',
  priceInr: 65000,
  listingUrl: 'https://pashusetu.in/listings/clabc123',
}

describe('buildWhatsappUrl (BR-063)', () => {
  it('uses wa.me with E.164 digits and no leading +', () => {
    const url = buildWhatsappUrl('+919876543210', prefill)
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true)
    expect(url).not.toContain('+91')
    expect(url).not.toContain('wa.me/+')
  })

  it('strips any non-digit characters from the phone', () => {
    const url = buildWhatsappUrl('+91 98765-43210', prefill)
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true)
  })

  it('URL-encodes the Marathi prefill', () => {
    const url = buildWhatsappUrl('+919876543210', prefill)
    const text = decodeURIComponent(url.split('?text=')[1])
    expect(text).toBe(whatsappPrefill(prefill))
  })

  it('never puts the phone number in the prefill text (BR-066)', () => {
    const url = buildWhatsappUrl('+919876543210', prefill)
    const text = decodeURIComponent(url.split('?text=')[1])
    expect(text).not.toContain('9876543210')
    expect(text).not.toContain('919876543210')
  })
})

describe('whatsappPrefill (BR-063 canonical string)', () => {
  it('includes breed, species, ₹price and the listing URL', () => {
    const text = whatsappPrefill(prefill)
    expect(text).toContain('गीर गाय')
    expect(text).toContain('₹65,000')
    expect(text).toContain('https://pashusetu.in/listings/clabc123')
    expect(text).toContain('जनावर अजून विक्रीसाठी आहे का?')
  })
})

describe('speciesMr', () => {
  it('maps every species to Marathi', () => {
    expect(speciesMr('COW')).toBe('गाय')
    expect(speciesMr('BUFFALO')).toBe('म्हैस')
    expect(speciesMr('BULL_OX')).toBe('बैल')
    expect(speciesMr('GOAT')).toBe('शेळी')
    expect(speciesMr('SHEEP')).toBe('मेंढी')
  })
})
