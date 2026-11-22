import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetSessionBoot } from '@/app/providers/SessionProvider'
import { resetClientState } from '@/shared/api/client'
import { installMatchMedia, setMedia } from './matchMedia'
import { server } from './msw/server'

installMatchMedia()

// Lazily imported routes are transformed on first use, which can take over a second.
configure({ asyncUtilTimeout: 5000 })

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
  resetClientState()
  resetSessionBoot()
  setMedia({ desktop: false, light: false })
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})
afterAll(() => server.close())
