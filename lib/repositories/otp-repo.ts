// OTP challenge + throttle persistence (Prisma only, doc 09 §2 layering). All the
// cap enforcement uses ATOMIC conditional UPDATEs (updateMany with a bound in the
// WHERE + {increment}) rather than read-then-write, so concurrent requests
// serialize on the row lock and the caps hold under parallelism (the review found
// the read-then-write version let concurrent verifies/sends bypass the caps).

import type { OtpChallenge, OtpIpThrottle } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export function getChallenge(phone: string): Promise<OtpChallenge | null> {
  return prisma.otpChallenge.findUnique({ where: { phone } })
}

export function getIpThrottle(ip: string): Promise<OtpIpThrottle | null> {
  return prisma.otpIpThrottle.findUnique({ where: { ip } })
}

/**
 * Atomically consume one verify attempt IFF the challenge is still under the cap.
 * Returns true if a slot was reserved (caller may test the code), false if the
 * cap is reached or the challenge is gone. The conditional UPDATE takes a row
 * lock, so at most `max` attempts ever succeed no matter how many verifies race —
 * this is the hard brute-force bound (closes the TOCTOU on the attempt counter).
 */
export async function reserveVerifyAttempt(phone: string, max: number): Promise<boolean> {
  const { count } = await prisma.otpChallenge.updateMany({
    where: { phone, attempts: { lt: max } },
    data: { attempts: { increment: 1 } },
  })
  return count === 1
}

/** Single-use: drop the challenge on success. Idempotent (ignores "not found"). */
export async function clearChallenge(phone: string): Promise<void> {
  await prisma.otpChallenge.deleteMany({ where: { phone } })
}

type CodeWrite = { codeHash: string; salt: string; expiresAt: Date; now: Date }

export type PhoneSendOutcome = 'sent' | 'cooldown' | 'capped' | 'reset-needed'

/**
 * Atomically claim a per-phone send slot AND write the new code in ONE conditional
 * UPDATE: matches only an in-window row that is under the cap and past the resend
 * cooldown, incrementing sendCount and overwriting the code (attempts reset to 0).
 * 'sent' → claimed+written; otherwise the caller reads the row to distinguish a
 * fresh window ('reset-needed' → call resetPhoneSend), an active cooldown, or a
 * full window ('capped'). The atomic match makes the per-phone cap a hard limit.
 */
export async function claimPhoneSendAndWrite(
  phone: string,
  opts: CodeWrite & { cooldownMs: number; windowMs: number; maxSends: number },
): Promise<PhoneSendOutcome> {
  const windowFloor = new Date(opts.now.getTime() - opts.windowMs)
  const cooldownFloor = new Date(opts.now.getTime() - opts.cooldownMs)
  const { count } = await prisma.otpChallenge.updateMany({
    where: {
      phone,
      windowStart: { gte: windowFloor },
      sendCount: { lt: opts.maxSends },
      lastSentAt: { lte: cooldownFloor },
    },
    data: {
      codeHash: opts.codeHash,
      salt: opts.salt,
      expiresAt: opts.expiresAt,
      attempts: 0,
      sendCount: { increment: 1 },
      lastSentAt: opts.now,
    },
  })
  if (count === 1) return 'sent'

  const row = await prisma.otpChallenge.findUnique({ where: { phone } })
  if (!row || row.windowStart < windowFloor) return 'reset-needed'
  if (row.lastSentAt > cooldownFloor) return 'cooldown'
  return 'capped'
}

/** Start a fresh send window for a phone (no row yet, or the old window expired). */
export async function resetPhoneSend(phone: string, w: CodeWrite): Promise<void> {
  const data = {
    codeHash: w.codeHash,
    salt: w.salt,
    expiresAt: w.expiresAt,
    attempts: 0,
    sendCount: 1,
    windowStart: w.now,
    lastSentAt: w.now,
  }
  await prisma.otpChallenge.upsert({ where: { phone }, create: { phone, ...data }, update: data })
}

/**
 * Atomically claim a per-IP send slot within the rolling window. Returns true if
 * claimed, false if the IP is at its cap for the current window. Only the
 * window-reset path (no row / stale window) is a plain upsert, so the sole race is
 * a benign handful of extra sends exactly at a window boundary — the in-window cap
 * itself is a hard limit via the conditional increment.
 */
export async function claimIpSend(
  ip: string,
  opts: { now: Date; windowMs: number; maxSends: number },
): Promise<boolean> {
  const windowFloor = new Date(opts.now.getTime() - opts.windowMs)
  const { count } = await prisma.otpIpThrottle.updateMany({
    where: { ip, windowStart: { gte: windowFloor }, sendCount: { lt: opts.maxSends } },
    data: { sendCount: { increment: 1 } },
  })
  if (count === 1) return true

  const row = await prisma.otpIpThrottle.findUnique({ where: { ip } })
  if (row && row.windowStart >= windowFloor) return false // in-window and at cap

  await prisma.otpIpThrottle.upsert({
    where: { ip },
    create: { ip, sendCount: 1, windowStart: opts.now },
    update: { sendCount: 1, windowStart: opts.now },
  })
  return true
}
