// biome-ignore-all lint/plugin: hex strings are test inputs for the card renderer
import {
  averageColor,
  DIRECTIONS,
  gradientAngle,
  isDirection,
  relativeLuminance,
  resolveCardStyle,
  TEMPLATES,
  toneForColor,
} from './cardStyle'

describe('gradientAngle', () => {
  it('maps all 8 compass directions to CSS angles (flowing toward the direction)', () => {
    expect(DIRECTIONS.map((d) => [d, gradientAngle(d)])).toEqual([
      ['N', 0],
      ['NE', 45],
      ['E', 90],
      ['SE', 135],
      ['S', 180],
      ['SW', 225],
      ['W', 270],
      ['NW', 315],
    ])
  })
  it('SE runs from the top-left corner to the bottom-right (135deg)', () => {
    expect(
      resolveCardStyle({ mode: 'GRADIENT', colors: ['#4480EE', '#0E76B7'], direction: 'SE' })
        .background,
    ).toBe('linear-gradient(135deg, #4480EE, #0E76B7)')
  })
  it('opposite directions are exactly 180 degrees apart', () => {
    for (const [a, b] of [
      ['N', 'S'],
      ['NE', 'SW'],
      ['E', 'W'],
      ['SE', 'NW'],
    ] as const) {
      expect(Math.abs(gradientAngle(a) - gradientAngle(b))).toBe(180)
    }
  })
  it('recognises only valid directions', () => {
    expect(isDirection('SE')).toBe(true)
    for (const bad of ['se', 'X', '', undefined, 5]) expect(isDirection(bad)).toBe(false)
  })
})

describe('contrast-aware text', () => {
  it('computes WCAG relative luminance', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#FF0000')).toBeCloseTo(0.2126, 3)
    expect(relativeLuminance('nonsense')).toBe(0)
  })
  it('uses light text on dark backgrounds and dark text on light ones', () => {
    expect(toneForColor('#000000')).toBe('light')
    expect(toneForColor('#0F2027')).toBe('light')
    expect(toneForColor('#5E5CE6')).toBe('light')
    expect(toneForColor('#FFFFFF')).toBe('dark')
    expect(toneForColor('#FFD60A')).toBe('dark')
    expect(toneForColor('#92FE9D')).toBe('dark')
    // Mid blue: black text (5.6:1) beats white text (3.75:1), so the tone is dark.
    expect(toneForColor('#4480EE')).toBe('dark')
  })
  it('always picks a tone with at least 4.5:1 contrast, for any colour', () => {
    const ratio = (L: number, text: 'light' | 'dark') =>
      text === 'light' ? 1.05 / (L + 0.05) : (L + 0.05) / 0.05
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
          expect(ratio(relativeLuminance(hex), toneForColor(hex)), hex).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })
  it('judges a gradient by the average of its two colours', () => {
    expect(averageColor('#000000', '#FFFFFF')).toBe('#808080')
    expect(
      resolveCardStyle({ mode: 'GRADIENT', colors: ['#FFFFFF', '#FFFF00'], direction: 'E' }).tone,
    ).toBe('dark')
    expect(
      resolveCardStyle({ mode: 'GRADIENT', colors: ['#000000', '#222222'], direction: 'E' }).tone,
    ).toBe('light')
  })
})

describe('resolveCardStyle', () => {
  it('solid uses its colour', () => {
    expect(resolveCardStyle({ mode: 'SOLID', color: '#FF2D55' })).toEqual({
      background: '#FF2D55',
      tone: 'dark',
    })
  })
  it('falls back to a safe default for a missing or malformed style', () => {
    expect(resolveCardStyle(undefined).background).toBeTruthy()
    expect(resolveCardStyle({ mode: 'GRADIENT', colors: ['#000000'] }).background).toBeTruthy()
  })
  it('templates use their own background, and unknown ids fall back', () => {
    expect(resolveCardStyle({ mode: 'TEMPLATE', templateId: 'marble' })).toEqual(TEMPLATES.marble)
    expect(resolveCardStyle({ mode: 'TEMPLATE', templateId: 'nope' })).toEqual(TEMPLATES.classic)
  })
  it('defaults a gradient with an unknown direction to SE', () => {
    expect(
      resolveCardStyle({
        mode: 'GRADIENT',
        colors: ['#000000', '#FFFFFF'],
        direction: 'bogus' as never,
      }).background,
    ).toContain('135deg')
  })
})
