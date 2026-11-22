import type { CSSProperties } from 'react'

/** Class that eases an element in after its siblings. Pair with `staggerStyle(i)`. */
export const STAGGER = 'stagger-in'

/** The row index the CSS delay is computed from. */
export const staggerStyle = (i: number): CSSProperties => ({ '--i': i }) as CSSProperties
