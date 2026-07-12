// SMS provider dispatch (lib/otp/sms-provider). Fast2SMS "OTP route" contract:
// key in the Authorization header, form-encoded route=otp + code + 10-digit
// number; success is HTTP 200 with { return: true }. fetch is stubbed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendOtpSms } from '@/lib/otp/sms-provider'

const okResponse = () => new Response(JSON.stringify({ return: true }), { status: 200 })

describe('sendOtpSms (fast2sms)', () => {
  beforeEach(() => {
    vi.stubEnv('SMS_OTP_PROVIDER', 'fast2sms')
    vi.stubEnv('FAST2SMS_API_KEY', 'test-key-123')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('POSTs the code on the OTP route with the key header and 10-digit number', async () => {
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    await sendOtpSms('+919876543210', '246810')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('fast2sms.com')
    expect((init.headers as Record<string, string>).authorization).toBe('test-key-123')
    const body = String(init.body)
    expect(body).toContain('route=otp')
    expect(body).toContain('variables_values=246810')
    expect(body).toContain('numbers=9876543210') // +91 stripped
  })

  it('throws when the provider reports failure (return:false)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ return: false }), { status: 200 })),
    )
    await expect(sendOtpSms('+919876543210', '246810')).rejects.toThrow()
  })

  it('throws on a non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    )
    await expect(sendOtpSms('+919876543210', '246810')).rejects.toThrow()
  })

  it('throws when FAST2SMS_API_KEY is missing', async () => {
    vi.stubEnv('FAST2SMS_API_KEY', '')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse()),
    )
    await expect(sendOtpSms('+919876543210', '246810')).rejects.toThrow(/FAST2SMS_API_KEY/)
  })

  it('throws on an unknown provider', async () => {
    vi.stubEnv('SMS_OTP_PROVIDER', 'carrier-pigeon')
    await expect(sendOtpSms('+919876543210', '246810')).rejects.toThrow(/carrier-pigeon/)
  })
})
