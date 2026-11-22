/** jsdom has no matchMedia. This installs a controllable fake. */
interface MediaState {
  desktop: boolean
  /** >= 1024px. Follows `desktop` unless set explicitly. */
  wide: boolean
  light: boolean
}

const state: MediaState = { desktop: false, wide: false, light: false }
const listeners = new Set<() => void>()

function matches(query: string): boolean {
  if (query.includes('min-width: 768px')) return state.desktop
  if (query.includes('min-width: 1024px')) return state.wide
  if (query.includes('prefers-color-scheme: light')) return state.light
  return false
}

export function setMedia(next: Partial<MediaState>) {
  Object.assign(state, 'wide' in next ? next : { wide: next.desktop ?? state.wide, ...next })
  for (const l of listeners) l()
}

export function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      get matches() {
        return matches(query)
      },
      media: query,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  })
}
