import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it('allows same-site relative paths', () => {
    expect(safeRedirect('/history')).toBe('/history')
    expect(safeRedirect('/s/abc/wallets?x=1')).toBe('/s/abc/wallets?x=1')
  })
  it('blocks off-site and malformed targets', () => {
    for (const bad of [
      '//evil.example',
      'https://evil.example',
      '/\\evil',
      'javascript:alert(1)',
      '',
      5,
      null,
    ]) {
      expect(safeRedirect(bad), String(bad)).toBeUndefined()
    }
  })
})
