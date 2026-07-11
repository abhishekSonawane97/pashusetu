import type { Metadata, Viewport } from 'next'
import { Lato, Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'
import { OfflineBanner } from '@/components/pwa/OfflineBanner'
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar'
import { BottomNav } from '@/components/layout/BottomNav'
import { SITE_URL, DEFAULT_OG, seoAlternates } from '@/lib/seo/site'

// Type pairing per the designer's tokens.css (§Type, CR-01): Lato carries Latin
// + digits, Noto Sans Devanagari carries the Marathi (default) script.
// Marathi-first per locked decision D8; self-hosted via next/font.
const lato = Lato({
  variable: '--font-latin',
  subsets: ['latin'],
  weight: ['400', '700'],
})

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: '--font-devanagari',
  subsets: ['devanagari'],
  weight: ['400', '700'],
})

// Root metadata (NFR-09). metadataBase makes every relative canonical/OG URL
// absolute against SITE_URL; the title template appends the brand to page titles.
// Phone numbers never appear in any of these surfaces (BR-066).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'पशुसेतू — महाराष्ट्रातील गाय, म्हैस, शेळी खरेदी-विक्री',
    template: '%s | पशुसेतू',
  },
  description:
    'शेतकरी आणि खरेदीदारांना थेट जोडणारा विश्वासू पशुधन बाजार — महाराष्ट्रासाठी. ' +
    'PashuSetu: the trusted livestock marketplace for Maharashtra, connecting farmers and buyers directly.',
  applicationName: 'पशुसेतू',
  alternates: seoAlternates('/'),
  openGraph: {
    type: 'website',
    siteName: 'पशुसेतू',
    locale: 'mr_IN',
    url: '/',
    title: 'पशुसेतू — महाराष्ट्रातील पशुधन बाजार',
    description: 'गाय, म्हैस, बैल, शेळी, मेंढी — थेट शेतकऱ्यांकडून खरेदी-विक्री.',
    images: [{ url: DEFAULT_OG, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'पशुसेतू — महाराष्ट्रातील पशुधन बाजार',
    description: 'गाय, म्हैस, बैल, शेळी, मेंढी — थेट शेतकऱ्यांकडून खरेदी-विक्री.',
    images: [DEFAULT_OG],
  },
  appleWebApp: { capable: true, title: 'पशुसेतू', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
}

// themeColor lives in viewport (Next 15+), not metadata — matches the manifest.
export const viewport: Viewport = {
  themeColor: '#C2185B',
  width: 'device-width',
  initialScale: 1,
}

// Site-level Organization + WebSite JSON-LD (brand recognition). Same
// server-only, `<`-escaped dangerouslySetInnerHTML pattern as ListingJsonLd
// (doc 12 §8.3); values are static constants, never user input.
function SiteJsonLd() {
  const json = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#org`,
        name: 'पशुसेतू',
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512.png`,
        description: 'महाराष्ट्रातील शेतकरी आणि खरेदीदारांसाठी विश्वासू पशुधन बाजार.',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'पशुसेतू',
        url: SITE_URL,
        inLanguage: 'mr-IN',
        publisher: { '@id': `${SITE_URL}/#org` },
      },
    ],
  }
  const safe = JSON.stringify(json).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- doc 12 §8.3: static constants, `<` escaped
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="mr"
      className={`${notoSansDevanagari.variable} ${lato.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteJsonLd />
        <OfflineBanner />
        {children}
        <BottomNav />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
