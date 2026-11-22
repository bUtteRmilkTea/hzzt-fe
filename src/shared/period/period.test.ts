import { periodLabel } from './format'
import {
  DEFAULT_PERIOD,
  isValidDay,
  PERIOD_PRESETS,
  type Period,
  parsePeriodSearch,
  periodFromSearch,
  periodsEqual,
  periodToApiQuery,
  periodToSearch,
  validatePeriodSearch,
} from './index'

describe('period <-> search param round trip', () => {
  it.each(PERIOD_PRESETS.map((p) => p.value))('preset %s survives', (preset) => {
    const p: Period = { kind: 'preset', preset }
    expect(periodFromSearch(periodToSearch(p))).toEqual(p)
    expect(periodToSearch(p)).toEqual({ period: preset })
  })

  it('a custom range survives', () => {
    const p: Period = { kind: 'range', from: '2026-01-01', to: '2026-01-31' }
    expect(periodToSearch(p)).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    expect(periodFromSearch(periodToSearch(p))).toEqual(p)
  })

  it('a custom range wins over a preset, as on the backend', () => {
    expect(periodFromSearch({ period: 'TODAY', from: '2026-02-01', to: '2026-02-03' })).toEqual({
      kind: 'range',
      from: '2026-02-01',
      to: '2026-02-03',
    })
  })

  it('swaps a reversed range instead of failing', () => {
    expect(periodFromSearch({ from: '2026-03-10', to: '2026-03-01' })).toEqual({
      kind: 'range',
      from: '2026-03-01',
      to: '2026-03-10',
    })
  })

  it('sanitises hostile or malformed params to the default', () => {
    for (const bad of [
      {},
      { period: 'EVERYTHING' },
      { period: 5 },
      { from: '2026-13-01', to: '2026-01-02' },
      { from: '2026-02-30', to: '2026-03-01' },
      { from: '2026-01-01' },
      { from: '<script>', to: 'x' },
    ]) {
      expect(periodFromSearch(bad), JSON.stringify(bad)).toEqual(DEFAULT_PERIOD)
    }
  })

  it('validatePeriodSearch drops unknown params', () => {
    expect(validatePeriodSearch({ period: 'LAST_7_DAYS', evil: 'x' })).toEqual({
      period: 'LAST_7_DAYS',
    })
  })

  it('never writes the default into the URL: a plain link stays plain', () => {
    expect(validatePeriodSearch({})).toEqual({})
    expect(validatePeriodSearch({ period: 'EVERYTHING' })).toEqual({})
    expect(parsePeriodSearch({})).toBeNull()
    expect(parsePeriodSearch({ period: 'TODAY' })).toEqual({ kind: 'preset', preset: 'TODAY' })
  })

  it('maps to the API query the backend expects', () => {
    expect(periodToApiQuery({ kind: 'preset', preset: 'LAST_30_DAYS' })).toEqual({
      period: 'LAST_30_DAYS',
    })
    expect(periodToApiQuery({ kind: 'range', from: '2026-01-01', to: '2026-01-02' })).toEqual({
      from: '2026-01-01',
      to: '2026-01-02',
    })
  })
})

describe('labels and equality', () => {
  it('labels presets and ranges', () => {
    expect(periodLabel({ kind: 'preset', preset: 'THIS_YEAR' })).toBe('This year')
    expect(periodLabel({ kind: 'range', from: '2026-01-01', to: '2026-01-31' })).toBe(
      '1 Jan 2026 – 31 Jan 2026',
    )
    expect(periodLabel({ kind: 'range', from: '2026-01-05', to: '2026-01-05' })).toBe('5 Jan 2026')
  })
  it('compares periods', () => {
    expect(
      periodsEqual({ kind: 'preset', preset: 'TODAY' }, { kind: 'preset', preset: 'TODAY' }),
    ).toBe(true)
    expect(
      periodsEqual({ kind: 'preset', preset: 'TODAY' }, { kind: 'preset', preset: 'THIS_WEEK' }),
    ).toBe(false)
    expect(
      periodsEqual(
        { kind: 'preset', preset: 'TODAY' },
        { kind: 'range', from: '2026-01-01', to: '2026-01-01' },
      ),
    ).toBe(false)
  })
  it('validates calendar days strictly', () => {
    expect(isValidDay('2028-02-29')).toBe(true)
    expect(isValidDay('2026-02-29')).toBe(false)
    expect(isValidDay('2026-1-1')).toBe(false)
  })
})
