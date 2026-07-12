// POST /auth/otp/send — send (or resend) a login OTP to a phone. Public (this is
// the pre-auth step). Throttled by phone + IP in the service; 429 carries
// retry-after. Never reveals whether the phone already has an account.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { clientIp } from '@/lib/api/request-ip'
import { sendOtpSchema } from '@/lib/validation/auth'
import * as otpService from '@/lib/services/otp-service'

export const POST = withRoute(async (req) => {
  const { phone } = await parseJsonBody(req, sendOtpSchema)
  await otpService.sendOtp(phone, clientIp(req))
  return Response.json({ sent: true })
})
