// Best-effort client IP for rate limiting. On Vercel the platform sets
// x-forwarded-for (client is the first hop); x-real-ip is the fallback. When
// neither is present all callers share the 'unknown' bucket — acceptable, since
// this only feeds a coarse abuse throttle, never identity.

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
