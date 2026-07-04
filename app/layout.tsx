import type { Metadata } from 'next'
import { Lato, Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'

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

export const metadata: Metadata = {
  title: 'पशुसेतू — PashuSetu',
  description:
    'शेतकरी आणि खरेदीदारांना थेट जोडणारा विश्वासू पशुधन बाजार — महाराष्ट्रासाठी. ' +
    'PashuSetu: the trusted livestock marketplace for Maharashtra, connecting farmers and buyers directly.',
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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
