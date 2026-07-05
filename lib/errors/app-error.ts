// AppError — docs/09-backend/README.md §5.1. Services THROW these; they never
// build responses. The only place errors become HTTP is withRoute() (handle.ts).
// Static factories exist for every registered code so services can never invent
// an unregistered one.

import { type ErrorCode, httpStatusFor } from './codes'

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly httpStatus: number,
    public readonly messageKey: string, // messages/*.json key under "apiErrors.*"
    public readonly details?: Record<string, unknown>,
  ) {
    super(code)
    this.name = 'AppError'
  }

  private static make(code: ErrorCode, details?: Record<string, unknown>, httpStatus?: number) {
    return new AppError(code, httpStatus ?? httpStatusFor(code), `apiErrors.${code}`, details)
  }

  // --- base codes ---
  static unauthenticated() {
    return AppError.make('UNAUTHENTICATED')
  }
  static forbidden(details?: Record<string, unknown>) {
    return AppError.make('FORBIDDEN', details)
  }
  static notFound() {
    return AppError.make('NOT_FOUND')
  }
  /**
   * VALIDATION_ERROR carries details.fields on every occurrence (doc 08 §1.3).
   * malformed=true → 400 (unparseable/bad types/enums/cursor); otherwise 422
   * (well-formed but violates a domain field rule).
   */
  static validation(fields: Record<string, string>, opts?: { malformed?: boolean }) {
    return AppError.make('VALIDATION_ERROR', { fields }, opts?.malformed ? 400 : 422)
  }
  static conflict(details?: Record<string, unknown>) {
    return AppError.make('CONFLICT', details)
  }
  static stateInvalid(details?: Record<string, unknown>) {
    return AppError.make('STATE_INVALID', details)
  }
  static rateLimited(retryAfterSeconds: number) {
    return AppError.make('RATE_LIMITED', { retryAfterSeconds })
  }
  static internal(eventId?: string) {
    return AppError.make('INTERNAL', eventId ? { eventId } : undefined)
  }

  // --- specific codes (doc 08 §1.3 "wire refinements") ---
  static userAlreadyExists() {
    return AppError.make('USER_ALREADY_EXISTS')
  }
  static userBanned() {
    return AppError.make('USER_BANNED')
  }
  static profileIncomplete() {
    return AppError.make('PROFILE_INCOMPLETE')
  }
  // publicState lets S-07 show the "विकले गेले" (SOLD) banner vs a generic
  // "unavailable" message without leaking any private data (doc 08 API-07).
  static listingNotFound(publicState?: 'SOLD' | 'UNAVAILABLE') {
    return AppError.make('LISTING_NOT_FOUND', publicState ? { publicState } : undefined)
  }
  static listingLimitReached(activeCount: number, limit = 10) {
    return AppError.make('LISTING_LIMIT_REACHED', { activeCount, limit })
  }
  static photoLimitExceeded(limit = 5) {
    return AppError.make('PHOTO_LIMIT_EXCEEDED', { limit })
  }
  static favoriteLimitReached(limit = 200) {
    return AppError.make('FAVORITE_LIMIT_REACHED', { limit })
  }
  static invalidStateTransition(from: string, action: string) {
    return AppError.make('INVALID_STATE_TRANSITION', { from, action })
  }
  static editNotAllowed(status: string) {
    return AppError.make('EDIT_NOT_ALLOWED', { status })
  }
  static declarationRequired() {
    return AppError.make('DECLARATION_REQUIRED')
  }
  static phoneInDescription(fields: Record<string, string>) {
    return AppError.make('PHONE_IN_DESCRIPTION', { fields })
  }
  static invalidUpload(reason: string) {
    return AppError.make('INVALID_UPLOAD', { reason })
  }
  static reportAlreadyExists() {
    return AppError.make('REPORT_ALREADY_EXISTS')
  }
  static listingNotReportable() {
    return AppError.make('LISTING_NOT_REPORTABLE')
  }
  static unsupportedMediaType() {
    return AppError.make('UNSUPPORTED_MEDIA_TYPE')
  }
}
