import { allocatePct } from './pct'

describe('allocatePct', () => {
  it('adds up to exactly 100.00 (largest remainder)', () => {
    const p = allocatePct(['1', '1', '1'])
    expect(p).toEqual(['33.34', '33.33', '33.33'])
    expect(p.reduce((a, b) => a + Number(b), 0).toFixed(2)).toBe('100.00')
  })
  it('gives 0.00 to zero and negative values, and all zeros when empty', () => {
    expect(allocatePct(['50', '0', '-5', '50'])).toEqual(['50.00', '0.00', '0.00', '50.00'])
    expect(allocatePct(['0', '0'])).toEqual(['0.00', '0.00'])
  })
})
