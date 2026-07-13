// Listing schemas — the BR-022 per-species field matrix (doc 04, rule owner),
// field bounds verbatim from its Validation column. Two tiers:
//   draft  — POST /listings / PATCH: any provided value must be valid, but
//            required-at-submit fields may be absent (DRAFT saves partially).
//   submit — POST /listings/{id}/submit (T-02 guard): the full R-matrix.
// Cross-field species/sex logic lives in listingFieldIssues() so create,
// edit-merge, and submit all evaluate the SAME rules (services call it with
// the merged row; the create schema calls it inline).

import { z } from 'zod'
import {
  description,
  interestTypeSchema,
  priceInr,
  sexSchema,
  shortText,
  speciesSchema,
} from './common'
import type { Sex, Species } from './common'

// ---- field bounds (BR-022 Validation column) ----
export const ageMonths = z.number().int().min(1).max(300)
export const weightKg = z.number().int().min(5).max(1500)
export const milkYieldLpd = z.number().min(0).max(60) // 0 = currently dry
export const lactationNumber = z.number().int().min(0).max(15) // 0 = not yet calved

// ---- BR-022 applicability matrix ----
// N/A fields MUST be null for that species/sex combination.
export function milkYieldAllowed(species: Species, sex: Sex | null | undefined): boolean {
  if (species === 'COW') return true // COW is always FEMALE
  if (species === 'BUFFALO' || species === 'GOAT') return sex === 'FEMALE'
  return false // BULL_OX, SHEEP, REDA (REDA is the male buffalo)
}

export function lactationAllowed(species: Species, sex: Sex | null | undefined): boolean {
  return milkYieldAllowed(species, sex) // same rows in the BR-022 matrix
}

export function pregnancyAllowed(species: Species, sex: Sex | null | undefined): boolean {
  if (species === 'COW') return true
  if (species === 'BULL_OX' || species === 'REDA') return false // both fixed MALE
  return sex === 'FEMALE' // BUFFALO, GOAT, SHEEP
}

/** Fixed-sex species (server rejects mismatches, BR-022): COW is FEMALE; BULL_OX
 * (ox) and REDA (he-buffalo) are MALE. The rest (BUFFALO/GOAT/SHEEP) state sex. */
export function fixedSexFor(species: Species): Sex | null {
  if (species === 'COW') return 'FEMALE'
  if (species === 'BULL_OX' || species === 'REDA') return 'MALE'
  return null
}

export type ListingFields = {
  species: Species
  breedId?: string | null
  sex?: Sex | null
  ageMonths?: number | null
  weightKg?: number | null
  milkYieldLpd?: number | null
  lactationNumber?: number | null
  isPregnant?: boolean | null
  isVaccinated?: boolean | null
  priceInr?: number | null
  negotiable?: boolean | null
  districtId?: string | null
  taluka?: string | null
  village?: string | null
  description?: string | null
}

/**
 * Cross-field BR-022 evaluation. Returns a per-field issue map (empty = valid),
 * ready for AppError.validation(details.fields). `tier: 'submit'` additionally
 * enforces the R columns; photo count (BR-023) and declaration (BR-027) are
 * separate submit guards owned by the service.
 */
export function listingFieldIssues(
  fields: ListingFields,
  tier: 'draft' | 'submit',
): Record<string, string> {
  const issues: Record<string, string> = {}
  const { species } = fields
  const sex = fields.sex ?? fixedSexFor(species)

  const fixed = fixedSexFor(species)
  if (fixed && fields.sex != null && fields.sex !== fixed) {
    issues.sex = `${species} implies ${fixed}`
  }

  if (!milkYieldAllowed(species, sex) && fields.milkYieldLpd != null) {
    issues.milkYieldLpd = `not applicable for ${species}${sex ? '/' + sex : ''} — must be null`
  }
  if (!lactationAllowed(species, sex) && fields.lactationNumber != null) {
    issues.lactationNumber = `not applicable for ${species}${sex ? '/' + sex : ''} — must be null`
  }
  if (!pregnancyAllowed(species, sex) && fields.isPregnant != null) {
    issues.isPregnant = `not applicable for ${species}${sex ? '/' + sex : ''} — must be null`
  }

  if (tier === 'submit') {
    const requireField = (key: keyof ListingFields, label = 'required at submit') => {
      if (fields[key] == null) issues[key] = label
    }
    requireField('breedId')
    requireField('ageMonths')
    requireField('priceInr')
    requireField('districtId')
    requireField('taluka') // tehsil — compulsory at submit (BR-022)
    requireField('village')
    requireField('description')
    if (!fixed) requireField('sex') // BUFFALO/GOAT/SHEEP must state sex
    // milk_yield_lpd: R for COW, R for BUFFALO when FEMALE (BR-022)
    if (
      fields.milkYieldLpd == null &&
      (species === 'COW' || (species === 'BUFFALO' && sex === 'FEMALE'))
    ) {
      issues.milkYieldLpd = 'required at submit'
    }
  }

  return issues
}

// ---- request schemas ----

// POST /listings — the wizard picks species first (S-10a); everything else may
// arrive later while the listing is DRAFT.
export const createListingSchema = z
  .object({
    species: speciesSchema,
    breedId: z.string().min(1).optional(),
    sex: sexSchema.optional(),
    ageMonths: ageMonths.optional(),
    weightKg: weightKg.nullable().optional(),
    milkYieldLpd: milkYieldLpd.nullable().optional(),
    lactationNumber: lactationNumber.nullable().optional(),
    isPregnant: z.boolean().nullable().optional(),
    isVaccinated: z.boolean().nullable().optional(),
    priceInr: priceInr.optional(),
    negotiable: z.boolean().default(true), // BR-026: UI copy only, never behavior
    districtId: z.string().min(1).optional(),
    taluka: shortText('taluka', 60).nullable().optional(),
    village: shortText('village', 60).nullable().optional(),
    description: description.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    for (const [field, message] of Object.entries(listingFieldIssues(data, 'draft'))) {
      ctx.addIssue({ code: 'custom', path: [field], message })
    }
  })

export type CreateListingInput = z.infer<typeof createListingSchema>

// PATCH /listings/{id} — API-09: any subset of the API-08 fields (species change
// resets the breedId compatibility check), plus imageOrder + declarationAccepted.
// Cross-field BR-022 rules re-run by the service on the MERGED row; the
// imageOrder permutation check and the T-09 declaration requirement are
// service-level guards. Privileged fields (status, sellerId, viewCount,
// approvedAt, expiresAt…) do not exist here.
export const updateListingSchema = z
  .object({
    species: speciesSchema.optional(),
    breedId: z.string().min(1).optional(),
    sex: sexSchema.optional(),
    ageMonths: ageMonths.optional(),
    weightKg: weightKg.nullable().optional(),
    milkYieldLpd: milkYieldLpd.nullable().optional(),
    lactationNumber: lactationNumber.nullable().optional(),
    isPregnant: z.boolean().nullable().optional(),
    isVaccinated: z.boolean().nullable().optional(),
    priceInr: priceInr.optional(),
    negotiable: z.boolean().optional(),
    districtId: z.string().min(1).optional(),
    taluka: shortText('taluka', 60).nullable().optional(),
    village: shortText('village', 60).nullable().optional(),
    description: description.optional(),
    // Permutation of ALL current image ids — validated against stored ids by the
    // service; counted as a photo change for BR-028/T-09.
    imageOrder: z.array(z.string().min(1)).max(5).optional(),
    // Must be true when the PATCH triggers T-09 re-moderation (BR-027); ignored otherwise.
    declarationAccepted: z.boolean().optional(),
  })
  .strict()

export type UpdateListingInput = z.infer<typeof updateListingSchema>

// POST /listings/{id}/submit — declaration presence is checked in the service so
// a missing/false value returns the specific DECLARATION_REQUIRED code (BR-027),
// not a generic validation error.
export const submitListingSchema = z
  .object({
    declarationAccepted: z.boolean().optional(),
  })
  .strict()

export type SubmitListingInput = z.infer<typeof submitListingSchema>

// POST /listings/{id}/interest (API-21) — a single contact type. The reveal +
// event log happen in the service; this only validates the discriminant (BR-062).
export const interestSchema = z
  .object({
    type: interestTypeSchema,
  })
  .strict()

export type InterestInput = z.infer<typeof interestSchema>
