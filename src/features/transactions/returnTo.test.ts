import { describe, expect, it } from 'vitest'
import { safeReturnTo } from './returnTo'

describe('safeReturnTo (F15-T04, RF-12)', () => {
  it('accepts in-app paths under /s/', () => {
    expect(safeReturnTo('/s/s-1/wallets/w-1')).toBe('/s/s-1/wallets/w-1')
    expect(safeReturnTo('/s/s-1/assets')).toBe('/s/s-1/assets')
  })
  it.each([
    'https://evil.example/s/x',
    '//evil.example',
    '/s//evil.example',
    '/\\evil.example',
    '/s/x:y',
    '/history',
    'javascript:alert(1)',
    '',
    '/s/a\nb',
    `/s/${'a'.repeat(300)}`,
  ])('rejects %j', (v) => expect(safeReturnTo(v)).toBeUndefined())
  it('rejects non-strings', () => {
    expect(safeReturnTo(undefined)).toBeUndefined()
    expect(safeReturnTo(42)).toBeUndefined()
  })
})
