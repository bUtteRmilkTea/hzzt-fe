import { toMoneyString } from '@/shared/money'
import { moveItem, sortWallets } from './hooks'

describe('sortWallets', () => {
  it('puts favourites first, then orders by sortOrder', () => {
    const out = sortWallets([
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 0 },
      { id: 'c', sortOrder: 5, isFavorite: true },
      { id: 'd', sortOrder: 2, isFavorite: true },
    ])
    expect(out.map((w) => w.id)).toEqual(['d', 'c', 'b', 'a'])
  })
  it('does not mutate its input', () => {
    const input = [
      { id: 'a', sortOrder: 2 },
      { id: 'b', sortOrder: 1 },
    ]
    sortWallets(input)
    expect(input.map((w) => w.id)).toEqual(['a', 'b'])
  })
})

describe('moveItem', () => {
  it('moves an item and leaves the original alone', () => {
    const list = ['a', 'b', 'c']
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(list, 0, 1)).toEqual(['b', 'a', 'c'])
    expect(list).toEqual(['a', 'b', 'c'])
  })
  it('clamps out-of-range targets', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, -5)).toEqual(['c', 'a', 'b'])
  })
  it('ignores an invalid source index', () => {
    expect(moveItem(['a', 'b'], 9, 0)).toEqual(['a', 'b'])
  })
})

describe('toMoneyString', () => {
  it('keeps strings exactly, coerces numbers, defaults to 0', () => {
    expect(toMoneyString('12345678901234567.89')).toBe('12345678901234567.89')
    expect(toMoneyString(1250.5)).toBe('1250.5')
    expect(toMoneyString(undefined)).toBe('0')
    expect(toMoneyString('')).toBe('0')
    expect(toMoneyString(Number.NaN)).toBe('0')
  })
})
