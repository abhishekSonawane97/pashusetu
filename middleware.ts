// Operational kill switches — docs/09-backend/README.md §3.4, docs/12 §9.2,
// docs/13 §1.2. Edge middleware checks BEFORE anything else; an env-var flip +
// redeploy (<2 min) is the containment lever of the incident runbook.

import { NextResponse, type NextRequest } from 'next/server'

const MAINTENANCE_MR = 'सेवा थोड्या वेळासाठी बंद आहे. कृपया नंतर पुन्हा प्रयत्न करा.' // "Service is briefly unavailable. Please try again later."

function serviceUnavailable() {
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: MAINTENANCE_MR } },
    { status: 503, headers: { 'retry-after': '120' } },
  )
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith('/api/v1')

  if (process.env.READ_ONLY_MODE === '1' && isApi && req.method !== 'GET') {
    return serviceUnavailable()
  }
  if (
    process.env.DISABLE_INTEREST === '1' &&
    req.method === 'POST' &&
    /^\/api\/v1\/listings\/[^/]+\/interest$/.test(pathname)
  ) {
    return serviceUnavailable()
  }
  if (
    process.env.DISABLE_UPLOADS === '1' &&
    req.method === 'POST' &&
    (pathname === '/api/v1/uploads/presign' ||
      /^\/api\/v1\/listings\/[^/]+\/images$/.test(pathname))
  ) {
    return serviceUnavailable()
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/v1/:path*'],
}
