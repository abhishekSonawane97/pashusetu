import type { Metadata } from 'next'
import { Noto_Sans, Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'

// Doc 10 §2 hard constraint: Noto Sans Devanagari for Marathi (default script),
// paired with Noto Sans for Latin. Marathi-first per locked decision D8.
const notoSans = Noto_Sans({
  variable: '--font-latin',
  subsets: ['latin'],
})

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: '--font-devanagari',
  subsets: ['devanagari'],
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
      className={`${notoSansDevanagari.variable} ${notoSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
