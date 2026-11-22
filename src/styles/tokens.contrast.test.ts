// biome-ignore-all lint/plugin: reads the token file and compares hex values
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { relativeLuminance } from '@/shared/ui/cardStyle'

const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

/** Variables declared in the block that starts with `selector {`. */
function vars(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const end = css.indexOf('\n}', start)
  const out: Record<string, string> = {}
  for (const m of css.slice(start, end).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g))
    out[m[1] as string] = m[2] as string
  return out
}

const dark = vars(':root')
const light = { ...dark, ...vars("[data-theme='light']") }

const ratio = (a: string, b: string) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ]
  return (hi + 0.05) / (lo + 0.05)
}

const themes = { dark, light } as const
const SURFACES = ['bg', 'surface-1', 'surface-2'] as const

describe.each(Object.entries(themes))('%s theme contrast (WCAG AA, 4.5:1 for text)', (_name, t) => {
  it.each(SURFACES)('body text on %s', (surface) => {
    for (const text of ['label', 'label-secondary', 'label-tertiary']) {
      expect(
        ratio(t[text] as string, t[surface] as string),
        `${text} on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('chips and segmented tracks (surface-3) stay readable', () => {
    for (const text of ['label', 'label-secondary']) {
      expect(
        ratio(t[text] as string, t['surface-3'] as string),
        `${text} on surface-3`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('the label on a primary button (accent) is readable', () => {
    expect(ratio(t['accent-label'] as string, t.accent as string)).toBeGreaterThanOrEqual(4.5)
  })
  it.each(SURFACES)('accent, up, down and warning used as text on %s', (surface) => {
    for (const c of ['accent', 'up', 'down', 'warning']) {
      expect(
        ratio(t[c] as string, t[surface] as string),
        `${c} on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('a destructive button label (on down) is readable', () => {
    expect(ratio(t['accent-label'] as string, t.down as string)).toBeGreaterThanOrEqual(4.5)
  })
})
