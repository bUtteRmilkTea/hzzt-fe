import { describe, expect, it } from 'vitest'
import { returnToFor, safeReturnTo } from './returnTo'

describe('safeReturnTo (F15-T04, RF-12)', () => {
  it('accepts in-app paths under /s/', () => {
    expect(safeReturnTo('/s/s-1/wallets/w-1')).toBe('/s/s-1/wallets/w-1')
    expect(safeReturnTo('/s/s-1/assets')).toBe('/s/s-1/assets')
    expect(safeReturnTo('/settings')).toBe('/settings')
  })
  it('accepts a query string, including a colon inside it', () => {
    expect(safeReturnTo('/s/s-1?period=month&range=3M')).toBe('/s/s-1?period=month&range=3M')
    expect(safeReturnTo('/s/s-1/history?from=2026-11-01T00:00&q=a%20b')).toBe(
      '/s/s-1/history?from=2026-11-01T00:00&q=a%20b',
    )
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
    `/s/${'a'.repeat(600)}`,
    '/s/x?next=//evil.example',
    '/s/x#frag',
    '/settings:evil',
    '/s:evil/x',
    '/s/x?a=b c',
  ])('rejects %j', (v) => expect(safeReturnTo(v)).toBeUndefined())
  it('rejects non-strings', () => {
    expect(safeReturnTo(undefined)).toBeUndefined()
    expect(safeReturnTo(42)).toBeUndefined()
  })
})

describe('returnToFor', () => {
  it('builds the path and query of where the user is', () => {
    expect(returnToFor({ pathname: '/s/s-1', searchStr: '?period=month' })).toBe(
      '/s/s-1?period=month',
    )
    expect(returnToFor({ pathname: '/s/s-1/history' })).toBe('/s/s-1/history')
    expect(returnToFor({ pathname: '/settings' })).toBe('/settings')
  })
  it('gives nothing for the add sheet itself or an unsafe place', () => {
    expect(
      returnToFor({ pathname: '/s/s-1/transactions/new', searchStr: '?type=EXPENSE' }),
    ).toBeUndefined()
    expect(returnToFor({ pathname: '/login' })).toBeUndefined()
  })
})
