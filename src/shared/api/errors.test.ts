import {
  AppError,
  ERROR_COPY,
  errorMessage,
  fieldErrors,
  GENERIC_ERROR,
  normalizeError,
  toAppError,
} from './errors'

describe('normalizeError', () => {
  it('reads code, message, details and request id from the envelope', () => {
    const e = normalizeError(
      {
        error: { code: 'VALIDATION_FAILED', message: 'bad', details: { email: 'x' } },
        requestId: 'r1',
      },
      400,
    )
    expect(e).toMatchObject({ code: 'VALIDATION_FAILED', status: 400, requestId: 'r1' })
    expect(e.details).toEqual({ email: 'x' })
  })
  it('falls back to INTERNAL_ERROR for a 5xx with no body', () => {
    expect(normalizeError(null, 502, 'hdr').code).toBe('INTERNAL_ERROR')
    expect(normalizeError(null, 502, 'hdr').requestId).toBe('hdr')
  })
})

describe('errorMessage', () => {
  it('gives friendly copy and never the raw code', () => {
    const msg = errorMessage(
      new AppError({ code: 'INVALID_CREDENTIALS', message: '', status: 401 }),
    )
    expect(msg).toBe(ERROR_COPY.INVALID_CREDENTIALS)
    expect(msg).not.toMatch(/INVALID_CREDENTIALS/)
  })
  it('falls back to the server message, then a generic line', () => {
    expect(
      errorMessage(new AppError({ code: 'NEW_CODE', message: 'Server says hi', status: 422 })),
    ).toBe('Server says hi')
    expect(errorMessage(new AppError({ code: 'NEW_CODE', message: '', status: 422 }))).toBe(
      GENERIC_ERROR,
    )
  })
  it('handles non-AppErrors', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe(ERROR_COPY.NETWORK_ERROR)
    expect(errorMessage('weird')).toBe(GENERIC_ERROR)
  })
  it('covers every code in the backend error catalog used by F2', () => {
    for (const code of [
      'EMAIL_ALREADY_REGISTERED',
      'INVALID_CREDENTIALS',
      'REFRESH_TOKEN_REUSED',
      'REFRESH_TOKEN_INVALID',
      'RESET_TOKEN_INVALID',
      'INVALID_CURRENT_PASSWORD',
      'RATE_LIMITED',
      'VALIDATION_FAILED',
    ]) {
      expect(ERROR_COPY[code], code).toBeTruthy()
    }
  })
})

describe('fieldErrors', () => {
  it('maps VALIDATION_FAILED details to lower-camel field names', () => {
    const e = new AppError({
      code: 'VALIDATION_FAILED',
      message: '',
      status: 400,
      details: { Email: 'must be a valid email address', password: 'must be at least 8' },
    })
    expect(fieldErrors(e)).toEqual({
      email: 'must be a valid email address',
      password: 'must be at least 8',
    })
  })
  it('is empty for other codes', () => {
    expect(fieldErrors(new AppError({ code: 'FORBIDDEN', message: '', status: 403 }))).toEqual({})
  })
})

describe('toAppError', () => {
  it('passes an AppError through', () => {
    const e = new AppError({ code: 'X', message: '', status: 1 })
    expect(toAppError(e)).toBe(e)
  })
})
