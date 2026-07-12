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

export type SearchQuery = z.infer<typeof searchQuerySchema>
