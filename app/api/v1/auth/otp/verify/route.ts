// POST /auth/otp/verify — verify the code and return a Firebase custom token the
// client exchanges via signInWithCustomToken(). Public. Wrong/expired code → 422
// (details.fields.otp = 'invalid' | 'expired'); too many tries → 429.

import { withRoute } from '@/lib/errors/handle'
import { parseJsonBody } from '@/lib/api/parse'
import { verifyOtpSchema } from '@/lib/validation/auth'
import * as otpService from '@/lib/services/otp-service'

export const POST = withRoute(async (req) => {
  const { phone, code } = await parseJsonBody(req, verifyOtpSchema)
  const result = await otpService.verifyOtp(phone, code)
  return Response.json(result)
})
