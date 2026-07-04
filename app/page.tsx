// S-05 home — minimal shell for the walking skeleton (M1). The real browse
// surface (species chips + latest listings, doc 06 S-05) lands with the
// Sprint 3 search stories; this page exists so auth flows have a landing
// target and the deploy smoke test has content to assert on.

import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md p-4">
      <h1>पशुसेतू</h1>
      <p>शेतकरी आणि खरेदीदारांना थेट जोडणारा विश्वासू पशुधन बाजार.</p>
      <p>The trusted livestock marketplace for Maharashtra — walking skeleton build.</p>
      <nav>
        <ul>
          <li>
            <Link href="/login">लॉगिन करा (Login)</Link>
          </li>
        </ul>
      </nav>
    </main>
  )
}
