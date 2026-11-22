import { describe, expect, it } from 'vitest'
import { coverage, PORTFOLIO_RANGES } from './portfolioHistory'

const today = new Date('2026-11-22T00:00:00Z')
const pts = (...d: string[]) => d.map((date) => ({ date }))

describe('coverage (F31)', () => {
  it('offers 1M, 3M, 6M, 12M and All time, 12M being the API 1Y', () => {
    expect(PORTFOLIO_RANGES.map((r) => [r.label, r.value])).toEqual([
      ['1M', '1M'],
      ['3M', '3M'],
      ['6M', '6M'],
      ['12M', '1Y'],
      ['All time', 'ALL'],
    ])
  })
  it('3 months of data with 6M chosen is short, and says 3 months', () => {
    expect(coverage(pts('2026-08-22', '2026-11-22'), '6M', today)).toEqual({
      short: true,
      spanLabel: '3 months',
    })
  })
  it('3 months of data with 3M chosen, or All time, is not short', () => {
    expect(coverage(pts('2026-08-22', '2026-11-22'), '3M', today).short).toBe(false)
    expect(coverage(pts('2026-08-22', '2026-11-22'), 'ALL', today).short).toBe(false)
  })
  it('a first point only 2 days late is not short', () => {
    expect(coverage(pts('2026-10-24', '2026-11-22'), '1M', today).short).toBe(false)
  })
  it('20 days of data with 1M chosen is short, and says 2 weeks', () => {
    expect(coverage(pts('2026-11-02', '2026-11-22'), '1M', today)).toEqual({
      short: true,
      spanLabel: '2 weeks',
    })
  })
  it('one point, and a few days, are labelled in days', () => {
    expect(coverage(pts('2026-11-22'), '1M', today)).toEqual({ short: true, spanLabel: '1 day' })
    expect(coverage(pts('2026-11-17', '2026-11-22'), '1M', today).spanLabel).toBe('5 days')
  })
})
