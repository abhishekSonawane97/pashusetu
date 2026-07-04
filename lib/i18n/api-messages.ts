// Localized API error messages — doc 08 §1.3 (`message` is a debugging aid,
// localized by Accept-Language per §1.5; clients branch on `code`, never on
// `message`). Marathi is the default locale (D8); English on explicit request.
// Full next-intl wiring lands with PS-057; this resolver is the API-side slice.

import mr from '@/messages/mr.json'
import en from '@/messages/en.json'

export type ApiLocale = 'mr' | 'en'

export function resolveLocale(acceptLanguage: string | null): ApiLocale {
  if (!acceptLanguage) return 'mr'
  // First supported language wins; anything not explicitly English stays Marathi-first.
  const first = acceptLanguage.split(',')[0]?.trim().toLowerCase() ?? ''
  return first.startsWith('en') ? 'en' : 'mr'
}

type Catalog = { apiErrors?: Record<string, string> }

const catalogs: Record<ApiLocale, Catalog> = { mr, en }

export function apiErrorMessage(messageKey: string, locale: ApiLocale): string {
  const key = messageKey.replace(/^apiErrors\./, '')
  const catalog = catalogs[locale].apiErrors ?? {}
  const fallback = catalogs.mr.apiErrors ?? {}
  return catalog[key] ?? fallback[key] ?? key
}
