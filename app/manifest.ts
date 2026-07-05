// PWA web app manifest — NFR-11 / doc 10 §7 / locked decision D9. Maskable
// 192/512 icons come from the founder (design README "Known gaps"); the icon
// paths are wired now and the assets drop in when they arrive.
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PashuSetu — पशुसेतू',
    short_name: 'पशुसेतू',
    description: 'शेतकरी आणि खरेदीदारांना थेट जोडणारा विश्वासू पशुधन बाजार',
    lang: 'mr',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#C2185B', // --color-primary (designer tokens; founder may re-skin)
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
