import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { installMatchMedia, setMedia } from './matchMedia'
import { server } from './msw/server'

installMatchMedia()

// Vaul and Radix expect these browser APIs.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
}
Element.prototype.scrollIntoView ??= () => {}
window.scrollTo = () => {}

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  setMedia({ desktop: false, light: false })
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})
afterAll(() => server.close())
