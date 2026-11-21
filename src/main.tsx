import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { Providers } from '@/app/providers/Providers'
import { applyMotionPref } from '@/shared/motion/motionPref'
import { initObservability } from '@/shared/observability/sentry'
import './styles/globals.css'

async function enableMocking() {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW === 'true') {
    const { worker } = await import('../test/msw/browser')
    await worker.start({ onUnhandledFrame: 'bypass' })
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

// Honour the saved "Always play animations" choice before the first paint.
applyMotionPref()

// Error reporting is off unless VITE_SENTRY_DSN is set, and then loads lazily (D-F12).
void initObservability()

enableMocking().then(() => {
  createRoot(root).render(
    <StrictMode>
      <Providers>
        <App />
      </Providers>
    </StrictMode>,
  )
})
