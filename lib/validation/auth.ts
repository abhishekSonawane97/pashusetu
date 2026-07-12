// Login OTP request schemas. `phone` is the 10-digit Indian national number the
// S-02 form already holds (server prefixes +91); `code` is the 6-digit OTP.

import { z } from 'zod'

const phoneNational = z.string().regex(/^[6-9]\d{9}$/) // BR-010 (matches isValidPhone)

export const sendOtpSchema = z.object({ phone: phoneNational }).strict()

export const verifyOtpSchema = z
  .object({ phone: phoneNational, code: z.string().regex(/^\d{6}$/) })
  .strict()

export type SendOtpInput = z.infer<typeof sendOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
