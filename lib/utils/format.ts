// Formatting helpers — design hard rule 1: Latin digits only, Indian grouping
// (₹1,25,000). All formatting is client-side (doc 08 §1.5: money is integer INR
// in JSON; the ₹ symbol and grouping are presentational).

/** 125000 → "₹1,25,000" (Indian lakh/crore grouping, Latin digits). */
export function formatInr(rupees: number): string {
  return '₹' + rupees.toLocaleString('en-IN')
}

/**
 * Relative "time since posted" in Marathi (design: listing card shows age).
 * Coarse buckets — rural users don't need second precision.
 */
export function timeSinceMr(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'आत्ताच' // just now
  if (min < 60) return `${min} मिनिटांपूर्वी`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} तासांपूर्वी`
  const days = Math.floor(hr / 24)
  if (days === 1) return 'काल'
  if (days < 30) return `${days} दिवसांपूर्वी`
  const months = Math.floor(days / 30)
  return `${months} महिन्यांपूर्वी`
}

/** age_months → human Marathi, e.g. 30 → "2 वर्षे 6 महिने". */
export function ageMonthsToMr(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts: string[] = []
  if (y > 0) parts.push(`${y} वर्षे`)
  if (m > 0) parts.push(`${m} महिने`)
  return parts.join(' ') || '0 महिने'
}
