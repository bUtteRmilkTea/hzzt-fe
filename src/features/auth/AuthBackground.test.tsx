import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AUTH_BACKGROUNDS, AuthBackground, resolveAuthBackground } from './AuthBackground'

describe('AuthBackground (F22)', () => {
  it.each([
    ['blobs', 'blobs'],
    ['grid', 'grid'],
    ['sweep', 'sweep'],
    [' GRID ', 'grid'],
    ['nope', 'blobs'],
    ['', 'blobs'],
    [undefined, 'blobs'],
  ])('resolves %j to %s', (input, expected) => {
    expect(resolveAuthBackground(input)).toBe(expected)
  })

  it.each(AUTH_BACKGROUNDS)(
    '%s renders a hidden decoration with no interactive content',
    (variant) => {
      const { getByTestId } = render(<AuthBackground variant={variant} />)
      const el = getByTestId('auth-bg')
      expect(el).toHaveAttribute('aria-hidden', 'true')
      expect(el).toHaveAttribute('data-variant', variant)
      expect(el.querySelectorAll('a, button, input')).toHaveLength(0)
      expect(el.querySelectorAll('span').length).toBeGreaterThan(0)
    },
  )

  it('blobs draws three shapes, the others one', () => {
    expect(
      render(<AuthBackground variant="blobs" />).container.querySelectorAll('span'),
    ).toHaveLength(3)
    expect(
      render(<AuthBackground variant="grid" />).container.querySelectorAll('span'),
    ).toHaveLength(1)
    expect(
      render(<AuthBackground variant="sweep" />).container.querySelectorAll('span'),
    ).toHaveLength(1)
  })
})
