// PS-015 consistency gate: the generated Prisma enums and the zod enum schemas
// (lib/validation/common.ts) must expose the exact same value sets — both are
// transcriptions of doc 07's canonical enums and must never drift.
import { describe, expect, it } from 'vitest'
import { InterestType, ListingStatus, ReportReason, Sex, Species } from '@prisma/client'
import {
  interestTypeSchema,
  listingStatusSchema,
  reportReasonSchema,
  sexSchema,
  speciesSchema,
} from '@/lib/validation/common'

describe('Prisma enums <-> zod schemas (doc 07 canonical values)', () => {
  it.each([
    ['Species', Object.values(Species), speciesSchema.options],
    ['Sex', Object.values(Sex), sexSchema.options],
    ['InterestType', Object.values(InterestType), interestTypeSchema.options],
    ['ReportReason', Object.values(ReportReason), reportReasonSchema.options],
    ['ListingStatus', Object.values(ListingStatus), listingStatusSchema.options],
  ])('%s value sets are identical', (_name, prismaValues, zodValues) => {
    expect([...prismaValues].sort()).toEqual([...zodValues].sort())
  })
})
