import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('.stagger-in (F32)', () => {
  it('does not keep a transform after it ends, so drag-and-drop transforms are not overridden', () => {
    const css = readFileSync(`${__dirname}/globals.css`, 'utf8')
    const rule = (css.match(/\.stagger-in \{[^}]*\}/)?.[0] ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(rule).toContain('animation: row-in')
    expect(rule).toMatch(/\bbackwards\b/)
    expect(rule).not.toMatch(/\b(both|forwards)\b/)
  })
})
