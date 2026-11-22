import { barGeometry, donutGeometry, lineGeometry, plotValue } from './geometry'

const box = { width: 220, height: 120, margin: { top: 10, right: 10, bottom: 10, left: 10 } }

describe('plotValue', () => {
  it('turns a money string into a plot coordinate (geometry only)', () => {
    expect(plotValue('1250.5')).toBe(1250.5)
    expect(plotValue('-30')).toBe(-30)
    expect(plotValue('0')).toBe(0)
  })
})

describe('lineGeometry', () => {
  const data = [
    { date: '2026-11-01', value: '100' },
    { date: '2026-11-11', value: '200' },
    { date: '2026-11-21', value: '150', live: true },
  ]
  const g = lineGeometry(data, box)

  it('places the first point at the left edge and the last at the right edge of the plot', () => {
    expect(g.points[0]?.x).toBe(10)
    expect(g.points.at(-1)?.x).toBe(210)
  })
  it('puts a higher value higher on the screen (smaller y)', () => {
    const [a, b, c] = g.points
    expect((b?.y as number) < (a?.y as number)).toBe(true)
    expect((b?.y as number) < (c?.y as number)).toBe(true)
  })
  it('keeps every point inside the plot area', () => {
    for (const p of g.points) {
      expect(p.y).toBeGreaterThanOrEqual(box.margin.top)
      expect(p.y).toBeLessThanOrEqual(box.height - box.margin.bottom)
    }
  })
  it('marks the live point and exposes the original value strings', () => {
    expect(g.points.map((p) => p.live)).toEqual([false, false, true])
    expect(g.points.map((p) => p.value)).toEqual(['100', '200', '150'])
  })
  it('draws a line path and a closed area path', () => {
    expect(g.path.startsWith('M10,')).toBe(true)
    expect(g.areaPath.endsWith('Z')).toBe(true)
  })
  it('two points make a straight line from corner to corner of the padded range', () => {
    const two = lineGeometry(
      [
        { date: '2026-11-01', value: '0' },
        { date: '2026-11-02', value: '100' },
      ],
      { width: 200, height: 100, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
    )
    expect(two.path).toMatch(/^M0,\d+(\.\d+)?L200,\d+(\.\d+)?$/)
    expect(two.single).toBe(false)
  })
  it('a single point is a centred dot, not an empty plot', () => {
    const one = lineGeometry([{ date: '2026-11-19', value: '500', live: true }], box)
    expect(one.single).toBe(true)
    expect(one.points).toHaveLength(1)
    expect(one.points[0]?.x).toBe(110)
    expect(Number.isFinite(one.points[0]?.y)).toBe(true)
  })
  it('a flat series still gets a visible mid-height line', () => {
    const flat = lineGeometry(
      [
        { date: '2026-11-01', value: '300' },
        { date: '2026-11-05', value: '300' },
      ],
      box,
    )
    const ys = flat.points.map((p) => p.y)
    expect(ys[0]).toBe(ys[1])
    expect(ys[0]).toBeGreaterThan(box.margin.top)
    expect(ys[0]).toBeLessThan(box.height - box.margin.bottom)
  })
  it('handles negative net worth', () => {
    const neg = lineGeometry(
      [
        { date: '2026-11-01', value: '-500' },
        { date: '2026-11-02', value: '-100' },
      ],
      box,
    )
    expect(neg.points.every((p) => Number.isFinite(p.y))).toBe(true)
    expect((neg.points[1]?.y as number) < (neg.points[0]?.y as number)).toBe(true)
  })
})

describe('barGeometry', () => {
  const groups = [
    { label: '1–7 Nov', income: '100', expense: '50' },
    { label: '8–14 Nov', income: '0', expense: '200' },
    { label: '29–30 Nov', income: '0', expense: '0' },
  ]
  const g = barGeometry(groups, box)

  it('makes two bars per group, income then expense', () => {
    expect(g.bars).toHaveLength(6)
    expect(g.bars.slice(0, 2).map((b) => b.kind)).toEqual(['income', 'expense'])
  })
  it('scales heights to the largest value, so the tallest bar fills the plot', () => {
    const tallest = g.bars.find((b) => b.value === '200')
    expect(tallest?.height).toBeCloseTo(box.height - box.margin.top - box.margin.bottom)
    const half = g.bars.find((b) => b.label === '1–7 Nov' && b.kind === 'income')
    expect(half?.height).toBeCloseTo((box.height - box.margin.top - box.margin.bottom) / 2)
  })
  it('draws zero as a zero-height bar sitting on the baseline', () => {
    const zero = g.bars.find((b) => b.label === '29–30 Nov' && b.kind === 'income')
    expect(zero?.height).toBe(0)
    expect((zero?.y as number) + (zero?.height as number)).toBeCloseTo(g.baseline)
  })
  it('keeps the labels exactly as given', () => {
    expect(g.labels.map((l) => l.label)).toEqual(['1–7 Nov', '8–14 Nov', '29–30 Nov'])
  })
  it('bars never overlap and stay in the plot', () => {
    const sorted = [...g.bars].sort((a, b) => a.x - b.x)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1] as (typeof sorted)[number]
      expect((sorted[i] as (typeof sorted)[number]).x).toBeGreaterThanOrEqual(
        prev.x + prev.width - 0.001,
      )
    }
    expect(Math.min(...g.bars.map((b) => b.x))).toBeGreaterThanOrEqual(box.margin.left)
    expect(Math.max(...g.bars.map((b) => b.x + b.width))).toBeLessThanOrEqual(
      box.width - box.margin.right,
    )
  })
  it('does not divide by zero when everything is zero', () => {
    const none = barGeometry([{ label: 'a', income: '0', expense: '0' }], box)
    expect(none.bars.every((b) => b.height === 0 && Number.isFinite(b.y))).toBe(true)
  })
})

describe('donutGeometry', () => {
  it('sizes arcs by amount, and they add up to a full circle', () => {
    const arcs = donutGeometry(
      [
        { key: 'a', amount: '300' },
        { key: 'b', amount: '100' },
      ],
      50,
      30,
    )
    expect(arcs.map((a) => a.key)).toEqual(['a', 'b'])
    expect(arcs[0]?.fraction).toBeCloseTo(0.75, 1)
    expect(arcs[1]?.fraction).toBeCloseTo(0.25, 1)
    expect(arcs.reduce((n, a) => n + a.fraction, 0)).toBeCloseTo(1, 5)
    expect(arcs.every((a) => a.path.startsWith('M'))).toBe(true)
  })
  it('a single slice is the whole ring', () => {
    const [only] = donutGeometry([{ key: 'a', amount: '10' }], 50, 30)
    expect(only?.fraction).toBeCloseTo(1, 5)
  })
  it('returns nothing for an empty or all-zero set', () => {
    expect(donutGeometry([], 50, 30)).toEqual([])
    expect(donutGeometry([{ key: 'a', amount: '0' }], 50, 30)).toEqual([])
  })
  it('ignores negative amounts rather than drawing a backwards arc', () => {
    const arcs = donutGeometry(
      [
        { key: 'a', amount: '100' },
        { key: 'b', amount: '-50' },
      ],
      50,
      30,
    )
    expect(arcs.map((a) => a.key)).toEqual(['a'])
    expect(arcs[0]?.fraction).toBeCloseTo(1, 5)
  })
})
