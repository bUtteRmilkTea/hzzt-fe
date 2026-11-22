import { renderHook } from '@testing-library/react'
import { vi } from 'vitest'

const reduced = vi.hoisted(() => ({ value: false }))
vi.mock('motion/react', () => ({ useReducedMotion: () => reduced.value }))

import { springs, useSpring } from './index'

describe('useSpring', () => {
  it('returns the spring normally and an instant transition under reduced motion', () => {
    reduced.value = false
    expect(renderHook(() => useSpring('list')).result.current).toEqual(springs.list)
    reduced.value = true
    expect(renderHook(() => useSpring('list')).result.current).toEqual({ duration: 0 })
  })
})
