// biome-ignore-all lint/plugin: card templates and fallbacks hold user-facing card colours, not UI styling
import type { components } from '@/shared/api/schema'
import { DEFAULT_SPACE_COLOR } from './palette'

export type CardStyleDTO = components['schemas']['wallets.CardStyle']
export type CardMode = 'SOLID' | 'GRADIENT' | 'TEMPLATE'
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export const DIRECTIONS: readonly Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/**
 * CSS `linear-gradient` angle for a compass direction. The gradient flows TOWARD
 * the direction: SE runs from the top-left corner to the bottom-right (135deg).
 */
const ANGLES: Record<Direction, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
}

export function gradientAngle(direction: Direction): number {
  return ANGLES[direction]
}

export function isDirection(v: unknown): v is Direction {
  return typeof v === 'string' && v in ANGLES
}

/** Frontend-owned card backgrounds, keyed by the template ids the backend lists. */
export const TEMPLATES: Record<string, { background: string; tone: Tone }> = {
  classic: { background: 'linear-gradient(135deg, #1f2937, #4b5563)', tone: 'light' },
  carbon: {
    background: 'repeating-linear-gradient(45deg, #1a1a1a 0 4px, #232323 4px 8px)',
    tone: 'light',
  },
  marble: {
    background: 'radial-gradient(circle at 20% 20%, #ffffff, #d9d9de 45%, #b8b8c2)',
    tone: 'dark',
  },
  paper: { background: 'linear-gradient(180deg, #f7f1e3, #e6dcc3)', tone: 'dark' },
  waves: {
    background: 'repeating-radial-gradient(circle at 0 100%, #2193b0 0 12px, #1b7f98 12px 24px)',
    tone: 'light',
  },
  grid: {
    background:
      'linear-gradient(#0e1726 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(90deg, #0e1726 1px, transparent 1px) 0 0 / 20px 20px, #16233a',
    tone: 'light',
  },
}
const FALLBACK_TEMPLATE = TEMPLATES.classic as { background: string; tone: Tone }

export type Tone = 'light' | 'dark'

/** sRGB relative luminance (WCAG) of a `#RRGGBB` colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = Number.parseInt(m[1] as string, 16)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

/**
 * Which text tone is readable on this background: `light` text on a dark colour,
 * `dark` text on a light one. Picks whichever has the higher WCAG contrast ratio.
 */
export function toneForColor(hex: string): Tone {
  const L = relativeLuminance(hex)
  const contrastWithWhite = 1.05 / (L + 0.05)
  const contrastWithBlack = (L + 0.05) / 0.05
  return contrastWithWhite >= contrastWithBlack ? 'light' : 'dark'
}

/** Mix two `#RRGGBB` colours 50/50, used to judge a gradient's overall brightness. */
export function averageColor(a: string, b: string): string {
  const parse = (h: string) => Number.parseInt(h.replace('#', ''), 16)
  const x = parse(a)
  const y = parse(b)
  const mix = (shift: number) => Math.round((((x >> shift) & 255) + ((y >> shift) & 255)) / 2)
  const out = (mix(16) << 16) | (mix(8) << 8) | mix(0)
  return `#${out.toString(16).padStart(6, '0')}`
}

export interface ResolvedCard {
  background: string
  tone: Tone
}

/** Turn a stored card style into a CSS background and a readable text tone. */
export function resolveCardStyle(style: CardStyleDTO | undefined): ResolvedCard {
  const mode = style?.mode
  if (mode === 'GRADIENT' && style?.colors && style.colors.length >= 2) {
    const [c1, c2] = style.colors as [string, string]
    const angle = gradientAngle(isDirection(style.direction) ? style.direction : 'SE')
    return {
      background: `linear-gradient(${angle}deg, ${c1}, ${c2})`,
      tone: toneForColor(averageColor(c1, c2)),
    }
  }
  if (mode === 'TEMPLATE') {
    const t = (style?.templateId && TEMPLATES[style.templateId]) || FALLBACK_TEMPLATE
    return { background: t.background, tone: t.tone }
  }
  const color = style?.color || DEFAULT_SPACE_COLOR
  return { background: color, tone: toneForColor(color) }
}
