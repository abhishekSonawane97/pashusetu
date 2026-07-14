// GET /listings query schema — doc 08 §4.1. All filters optional, combine with
// AND. minPrice > maxPrice and unknown enums are malformed → 400 (the split is
// applied in the route via AppError.validation malformed flag). breed/species/
// district existence + relationship checks happen in the service (need the DB).

import { z } from 'zod'
import { speciesSchema } from './common'

export const searchQuerySchema = z
  .object({
    species: speciesSchema.optional(),
    breedId: z.string().min(1).optional(),
    districtId: z.string().min(1).optional(),
    taluka: z.string().min(1).max(60).optional(), // tehsil — free-text on listings (BR-022)
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    minMilk: z.coerce.number().min(0).max(60).optional(), // min milk yield (L/day)
    minAge: z.coerce.number().int().min(1).max(300).optional(), // months
    maxAge: z.coerce.number().int().min(1).max(300).optional(),
    isPregnant: z.enum(['1']).optional(), // '1' = show only pregnant animals
    sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
    sellerId: z.string().min(1).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .refine((q) => q.minPrice == null || q.maxPrice == null || q.minPrice <= q.maxPrice, {
    path: ['maxPrice'],
    message: 'minPrice must be <= maxPrice',
  })
  .refine((q) => q.minAge == null || q.maxAge == null || q.minAge <= q.maxAge, {
    path: ['maxAge'],
    message: 'minAge must be <= maxAge',
  })

export type SearchQuery = z.infer<typeof searchQuerySchema>
