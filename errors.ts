export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'METHOD_NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INTERNAL'

const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  METHOD_NOT_ALLOWED: 405,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL: 500,
}

/**
 * An error whose message is safe to show to the user.
 * Anything that is NOT an AppError is treated as internal and never leaked.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(code: ErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'AppError'
    this.code = code
    this.status = HTTP_STATUS[code]
  }
}

export interface PublicErrorBody {
  error: { code: ErrorCode; message: string; requestId?: string }
}

export function toPublicError(
  err: unknown,
  requestId?: string,
): { status: number; body: PublicErrorBody } {
  const withId = requestId === undefined ? {} : { requestId }
  if (err instanceof AppError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, ...withId } } }
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL', message: 'Something went wrong on our side.', ...withId } },
  }
}
