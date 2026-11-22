import { z } from 'zod'
import { DIRECTIONS, type Direction } from '@/shared/ui/cardStyle'
import { HEX_COLOR } from '@/shared/ui/palette'

const hex = z.string().regex(HEX_COLOR, 'Use a hex colour like #4480EE')

/** Mirrors the backend's per-mode card style payloads (a discriminated union on `mode`). */
export const cardStyleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('SOLID'), color: hex }),
  z.object({
    mode: z.literal('GRADIENT'),
    colors: z.tuple([hex, hex]),
    direction: z.enum(DIRECTIONS as unknown as [Direction, ...Direction[]]),
    presetId: z.string().max(40).nullable().optional(),
  }),
  z.object({ mode: z.literal('TEMPLATE'), templateId: z.string().min(1) }),
])
export type CardStylePayload = z.infer<typeof cardStyleSchema>

/**
 * The OpenAPI spec types `cardStyle` as an opaque object (swag cannot express the
 * per-mode union), so the generated request type rejects any real shape. This is the
 * one place that bridges the two; the Zod schema above is what actually guarantees the shape.
 */
export function toRequestCardStyle(payload: CardStylePayload): Record<string, undefined> {
  return cardStyleSchema.parse(payload) as unknown as Record<string, undefined>
}
