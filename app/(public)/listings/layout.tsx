// Server layout for /listings so the (client) search page gets SSR metadata
// (NFR-09: unique Marathi title/description + canonical). The nested detail route
// /listings/[id] overrides all of these in its own generateMetadata, so this
// only effectively titles the browse index. Transparent wrapper otherwise.
import type { Metadata } from 'next'
import { seoAlternates } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: 'जनावरे शोधा',
  description: 'गाय, म्हैस, बैल, शेळी, मेंढी — जिल्हा, जात व किंमतीनुसार जनावरे शोधा. पशुसेतू.',
  alternates: seoAlternates('/listings'),
  openGraph: {
    title: 'जनावरे शोधा | पशुसेतू',
    description: 'जिल्हा, जात व किंमतीनुसार जनावरे शोधा.',
    url: '/listings',
    type: 'website',
  },
}

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
