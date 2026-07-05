// BR-022 species/sex matrix — the app's trickiest validation, exercised cell
// by cell: fixed-sex species, N/A-must-be-null fields, submit-tier R columns.
import { describe, expect, it } from 'vitest'
import {
  createListingSchema,
  listingFieldIssues,
  submitListingSchema,
  updateListingSchema,
} from '@/lib/validation/listings'

const submittableCow = {
  species: 'COW' as const,
  breedId: 'cbreed0000000000000001',
  sex: 'FEMALE' as const,
  ageMonths: 48,
  milkYieldLpd: 12,
  priceInr: 65000,
  districtId: 'cdist00000000000000001',
  village: 'निगडी',
  description: 'चांगली गीर गाय आहे, दररोज 12 लिटर दूध देते. दुसरे वेत.',
}

describe('createListingSchema (draft tier)', () => {
  it('accepts species-only draft (wizard step 1)', () => {
    const parsed = createListingSchema.parse({ species: 'GOAT' })
    expect(parsed.negotiable).toBe(true) // BR-026 default
  })

  it('rejects sex mismatch on fixed-sex species: COW must be FEMALE, BULL_OX MALE', () => {
    expect(createListingSchema.safeParse({ species: 'COW', sex: 'MALE' }).success).toBe(false)
    expect(createListingSchema.safeParse({ species: 'BULL_OX', sex: 'FEMALE' }).success).toBe(false)
    expect(createListingSchema.safeParse({ species: 'COW', sex: 'FEMALE' }).success).toBe(true)
  })

  it('rejects N/A fields that are non-null: milk yield on BULL_OX and SHEEP', () => {
    expect(createListingSchema.safeParse({ species: 'BULL_OX', milkYieldLpd: 5 }).success).toBe(
      false,
    )
    expect(createListingSchema.safeParse({ species: 'SHEEP', milkYieldLpd: 2 }).success).toBe(false)
  })

  it('rejects milk/lactation on MALE buffalo but accepts on FEMALE', () => {
    expect(
      createListingSchema.safeParse({ species: 'BUFFALO', sex: 'MALE', milkYieldLpd: 8 }).success,
    ).toBe(false)
    expect(
      createListingSchema.safeParse({ species: 'BUFFALO', sex: 'FEMALE', milkYieldLpd: 8 }).success,
    ).toBe(true)
  })

  it('rejects isPregnant on BULL_OX but accepts on FEMALE sheep', () => {
    expect(createListingSchema.safeParse({ species: 'BULL_OX', isPregnant: true }).success).toBe(
      false,
    )
    expect(
      createListingSchema.safeParse({ species: 'SHEEP', sex: 'FEMALE', isPregnant: true }).success,
    ).toBe(true)
  })

  it('enforces field bounds: ageMonths 1–300, weightKg 5–1500, milk 0–60, lactation 0–15', () => {
    expect(createListingSchema.safeParse({ species: 'COW', ageMonths: 0 }).success).toBe(false)
    expect(createListingSchema.safeParse({ species: 'COW', ageMonths: 301 }).success).toBe(false)
    expect(createListingSchema.safeParse({ species: 'COW', weightKg: 4 }).success).toBe(false)
    expect(createListingSchema.safeParse({ species: 'COW', milkYieldLpd: 61 }).success).toBe(false)
    expect(createListingSchema.safeParse({ species: 'COW', lactationNumber: 16 }).success).toBe(
      false,
    )
    expect(createListingSchema.safeParse({ species: 'COW', milkYieldLpd: 0 }).success).toBe(true) // dry
  })

  it('blocks privileged/unknown fields (mass-assignment guard)', () => {
    expect(createListingSchema.safeParse({ species: 'COW', status: 'APPROVED' }).success).toBe(
      false,
    )
    expect(createListingSchema.safeParse({ species: 'COW', sellerId: 'x' }).success).toBe(false)
    expect(createListingSchema.safeParse({ species: 'COW', expiresAt: 'never' }).success).toBe(
      false,
    )
  })

  it('blocks phone numbers in village/description (BR-065)', () => {
    expect(
      createListingSchema.safeParse({ species: 'COW', village: 'निगडी 9876543210' }).success,
    ).toBe(false)
  })
})

describe('listingFieldIssues (submit tier — BR-022 R columns)', () => {
  it('fully-filled COW passes', () => {
    expect(listingFieldIssues(submittableCow, 'submit')).toEqual({})
  })

  it('COW without milk yield fails: milk_yield_lpd is R for COW', () => {
    const { milkYieldLpd: _omitted, ...rest } = submittableCow
    expect(listingFieldIssues(rest, 'submit')).toHaveProperty('milkYieldLpd')
  })

  it('FEMALE buffalo requires milk yield; MALE buffalo must NOT carry it', () => {
    const buffalo = { ...submittableCow, species: 'BUFFALO' as const }
    expect(listingFieldIssues(buffalo, 'submit')).toEqual({}) // FEMALE + milk present
    const { milkYieldLpd: _omitted, ...noMilk } = buffalo
    expect(listingFieldIssues(noMilk, 'submit')).toHaveProperty('milkYieldLpd')
    const male = { ...noMilk, sex: 'MALE' as const }
    expect(listingFieldIssues(male, 'submit')).toEqual({}) // milk N/A for MALE
  })

  it('sex is required at submit for non-fixed species, implied for fixed ones', () => {
    const goat = { ...submittableCow, species: 'GOAT' as const, sex: undefined, milkYieldLpd: null }
    expect(listingFieldIssues(goat, 'submit')).toHaveProperty('sex')
    const cow = { ...submittableCow, sex: undefined }
    expect(listingFieldIssues(cow, 'submit')).not.toHaveProperty('sex') // COW implies FEMALE
  })

  it('reports every missing R field in one map (wizard jump-to-step)', () => {
    const issues = listingFieldIssues({ species: 'SHEEP' }, 'submit')
    for (const key of [
      'breedId',
      'sex',
      'ageMonths',
      'priceInr',
      'districtId',
      'village',
      'description',
    ]) {
      expect(issues).toHaveProperty(key)
    }
    expect(issues).not.toHaveProperty('milkYieldLpd') // N/A for SHEEP, never required
  })
})

describe('update + submit schemas', () => {
  it('updateListingSchema: API-09 field set — species editable, imageOrder + declaration exist, privileged fields rejected', () => {
    expect(updateListingSchema.safeParse({ priceInr: 70000 }).success).toBe(true)
    expect(updateListingSchema.safeParse({ species: 'GOAT' }).success).toBe(true)
    expect(
      updateListingSchema.safeParse({ imageOrder: ['img1', 'img2'], declarationAccepted: true })
        .success,
    ).toBe(true)
    expect(updateListingSchema.safeParse({ status: 'SOLD' }).success).toBe(false)
    expect(updateListingSchema.safeParse({ viewCount: 999 }).success).toBe(false)
  })

  it('submitListingSchema: lenient boolean (declaration enforcement is in the service, BR-027)', () => {
    // The schema only shapes the field; the service turns a missing/false value
    // into the specific DECLARATION_REQUIRED code (verified in the integration test).
    expect(submitListingSchema.safeParse({ declarationAccepted: true }).success).toBe(true)
    expect(submitListingSchema.safeParse({ declarationAccepted: false }).success).toBe(true)
    expect(submitListingSchema.safeParse({}).success).toBe(true)
    expect(submitListingSchema.safeParse({ declarationAccepted: 'yes' }).success).toBe(false) // wrong type
    expect(submitListingSchema.safeParse({ foo: 1 }).success).toBe(false) // strict: unknown key
  })
})
