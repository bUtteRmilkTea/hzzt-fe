import { availableAfter, maxReserve, reserveProblem, ringOffset } from '../goals/reserve'
import { KINDS, kindMeta } from './kinds'
import { outstandingAfter, settlementProblem } from './settlement'

describe('settlement', () => {
  it('rejects zero, junk and more than is outstanding', () => {
    expect(settlementProblem('', '500')).toBe('Enter an amount greater than zero.')
    expect(settlementProblem('0', '500')).toBe('Enter an amount greater than zero.')
    expect(settlementProblem('abc', '500')).toBe('Enter an amount greater than zero.')
    expect(settlementProblem('500.01', '500')).toBe("That's more than what is outstanding.")
  })
  it('accepts anything up to and including the outstanding amount', () => {
    expect(settlementProblem('200', '500')).toBeNull()
    expect(settlementProblem('500', '500')).toBeNull()
    expect(settlementProblem('0.01', '500')).toBeNull()
  })
  it('settling 200 against a 500 debt leaves 300 outstanding, exactly', () => {
    expect(outstandingAfter('500', '200')).toBe('300')
    expect(outstandingAfter('0.3', '0.1')).toBe('0.2')
    expect(outstandingAfter('100', '250')).toBe('0') // never negative
    expect(outstandingAfter('100', 'x')).toBe('100')
  })
})

describe('goal reservations', () => {
  it("a wallet of 134.26 with 100 reserved has 34.26 available, and the cap includes this goal's own hold", () => {
    // available comes from the server (134.26 - 100); a goal already holding 100 may raise it by 34.26
    expect(maxReserve('34.26', '100')).toBe('134.26')
    expect(maxReserve('34.26', '0')).toBe('34.26')
  })
  it("blocks more than available plus the goal's current reserve, and nothing else", () => {
    expect(reserveProblem('134.27', '34.26', '100')).toMatch(/more than the available balance/)
    expect(reserveProblem('134.26', '34.26', '100')).toBeNull()
    expect(reserveProblem('34.27', '34.26', '0')).toMatch(/more than the available/)
    expect(reserveProblem('0', '34.26', '100')).toBeNull() // 0 clears the reservation
    expect(reserveProblem('', '34.26', '100')).toBeNull()
    expect(reserveProblem('abc', '34.26', '100')).toBe('Enter a number.')
  })
  it('shows what is left available after a reservation, exactly', () => {
    expect(availableAfter('34.26', '100', '100')).toBe('34.26')
    expect(availableAfter('34.26', '0', '30.1')).toBe('4.16')
    expect(availableAfter('10', '0', '')).toBe('10')
  })
})

describe('progress ring', () => {
  it('maps a percentage to a stroke offset and clamps it', () => {
    expect(ringOffset('0', 100)).toBe(100)
    expect(ringOffset('50', 100)).toBe(50)
    expect(ringOffset('100', 100)).toBe(0)
    expect(ringOffset('250', 100)).toBe(0)
    expect(ringOffset('-5', 100)).toBe(100)
    expect(ringOffset(undefined, 100)).toBe(100)
    expect(ringOffset('25.5', 200)).toBeCloseTo(149)
  })
})

describe('kinds', () => {
  it('lists the three kinds, and only owed money and debt settle', () => {
    expect(KINDS.map((k) => [k.kind, k.settles])).toEqual([
      ['FIXED_ASSET', false],
      ['RECEIVABLE', true],
      ['LIABILITY', true],
    ])
    expect(kindMeta('LIABILITY').settleLabel).toBe('Pay down')
    expect(kindMeta('nope').kind).toBe('FIXED_ASSET')
  })
})
