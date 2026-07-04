// Error-code registry — the closed union from docs/08-api/README.md §1.3.
// "No other code may be emitted by MVP code." Adding a code requires an
// additive version-1.x update to the doc 08 table FIRST, then here.

export const BASE_ERROR_CODES = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  BANNED: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422, // default; malformed-request variant is 400 (doc 08 §1.3 split)
  CONFLICT: 409,
  LIMIT_EXCEEDED: 409,
  STATE_INVALID: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const

export type BaseErrorCode = keyof typeof BASE_ERROR_CODES

// Specific wire refinements — each inherits the semantics of its base family.
export const SPECIFIC_ERROR_CODES = {
  USER_ALREADY_EXISTS: { httpStatus: 409, base: 'CONFLICT' },
  USER_BANNED: { httpStatus: 403, base: 'BANNED' },
  PROFILE_INCOMPLETE: { httpStatus: 403, base: 'FORBIDDEN' },
  LISTING_NOT_FOUND: { httpStatus: 404, base: 'NOT_FOUND' },
  LISTING_LIMIT_REACHED: { httpStatus: 409, base: 'LIMIT_EXCEEDED' },
  PHOTO_LIMIT_EXCEEDED: { httpStatus: 409, base: 'LIMIT_EXCEEDED' },
  FAVORITE_LIMIT_REACHED: { httpStatus: 409, base: 'LIMIT_EXCEEDED' },
  INVALID_STATE_TRANSITION: { httpStatus: 409, base: 'STATE_INVALID' },
  EDIT_NOT_ALLOWED: { httpStatus: 409, base: 'STATE_INVALID' },
  DECLARATION_REQUIRED: { httpStatus: 422, base: 'VALIDATION_ERROR' },
  PHONE_IN_DESCRIPTION: { httpStatus: 422, base: 'VALIDATION_ERROR' },
  INVALID_UPLOAD: { httpStatus: 422, base: 'VALIDATION_ERROR' },
  REPORT_ALREADY_EXISTS: { httpStatus: 409, base: 'CONFLICT' },
  LISTING_NOT_REPORTABLE: { httpStatus: 409, base: 'CONFLICT' },
  UNSUPPORTED_MEDIA_TYPE: { httpStatus: 415, base: 'VALIDATION_ERROR' },
} as const satisfies Record<string, { httpStatus: number; base: BaseErrorCode }>

export type SpecificErrorCode = keyof typeof SPECIFIC_ERROR_CODES

export type ErrorCode = BaseErrorCode | SpecificErrorCode

export function httpStatusFor(code: ErrorCode): number {
  if (code in SPECIFIC_ERROR_CODES) {
    return SPECIFIC_ERROR_CODES[code as SpecificErrorCode].httpStatus
  }
  return BASE_ERROR_CODES[code as BaseErrorCode]
}

export function baseOf(code: ErrorCode): BaseErrorCode {
  if (code in SPECIFIC_ERROR_CODES) {
    return SPECIFIC_ERROR_CODES[code as SpecificErrorCode].base
  }
  return code as BaseErrorCode
}
