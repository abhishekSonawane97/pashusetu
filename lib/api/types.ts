// Shared API response types — mirror the doc 08 §1.9 response shapes exactly.
// camelCase (doc 08 §1.6); enums tolerate unknown values for forward-compat.

import type { ListingStatus, Sex, Species } from '@/lib/validation/common'

export type BreedRef = { id: string; species: Species; nameEn: string; nameMr: string }
export type DistrictRef = { id: string; nameEn: string; nameMr: string; state: string }

/** API-06 search/list item (doc 08 §1.9). Carries NO seller object (BR-066). */
export type ListingCard = {
  id: string
  species: Species
  breed: BreedRef
  sex: Sex
  ageMonths: number
  priceInr: number
  negotiable: boolean
  isPregnant: boolean | null
  milkYieldLpd: number | null
  district: DistrictRef
  taluka: string | null
  village: string
  thumbnailUrl: string | null
  approvedAt: string
}

/** API-14 own-listing item: ListingCard + seller-only lifecycle fields. */
export type OwnListingItem = ListingCard & {
  status: ListingStatus
  rejectionReason: string | null
  expiresAt: string | null
  soldAt: string | null
  viewCount: number
  interestCount: number
  imageCount: number
  pendingSince: string | null
  createdAt: string
  updatedAt: string
}

export type Paginated<T> = { items: T[]; nextCursor: string | null }
