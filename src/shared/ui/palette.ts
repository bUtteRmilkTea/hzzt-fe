// biome-ignore-all lint/plugin: these are user-pickable avatar and card colours, not UI styling
/** Swatches a user can pick for a space avatar or wallet card. */
export const PALETTE = [
  '#4480EE',
  '#5E5CE6',
  '#AF52DE',
  '#FF2D55',
  '#FF453A',
  '#FF9F0A',
  '#FFD60A',
  '#34C759',
  '#30B0C7',
  '#64D2FF',
  '#8E8E93',
  '#A2845E',
] as const

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** Default avatar for a new space. */
export const DEFAULT_SPACE_COLOR = PALETTE[0]
export const DEFAULT_SPACE_EMOJI = '🏠'
