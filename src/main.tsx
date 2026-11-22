import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { Providers } from '@/app/providers/Providers'
import './styles/globals.css'

async function enableMocking() {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW === 'true') {
    const { worker } = await import('../test/msw/browser')
    await worker.start({ onUnhandledFrame: 'bypass' })
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

enableMocking().then(() => {
  createRoot(root).render(
    <StrictMode>
      <Providers>
        <App />
      </Providers>
    </StrictMode>,
  )
})
