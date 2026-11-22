import { useEffect, useState } from 'react'

type Updater = (reloadPage?: boolean) => Promise<void>

/**
 * Registers the service worker (production only) and tells the user when a new version is ready.
 * The update is the user's choice, so an open tab never loses a chunk out from under it.
 * A failed dynamic import (a hashed chunk that a new deployment removed) offers the same refresh.
 */
export function UpdatePrompt() {
  const [ready, setReady] = useState(false)
  const [update, setUpdate] = useState<Updater | null>(null)

  useEffect(() => {
    const onPreloadError = (event: Event) => {
      event.preventDefault()
      setReady(true)
    }
    window.addEventListener('vite:preloadError', onPreloadError)

    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      import('virtual:pwa-register')
        .then(({ registerSW }) => {
          const updateSW = registerSW({ onNeedRefresh: () => setReady(true) })
          setUpdate(() => updateSW)
        })
        .catch(() => {
          // Registration is best-effort: the app works without a service worker.
        })
    }
    return () => window.removeEventListener('vite:preloadError', onPreloadError)
  }, [])

  if (!ready) return null
  return (
    <div
      role="alert"
      className="pb-safe fixed inset-x-4 bottom-24 z-[90] mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3 shadow-sheet"
    >
      <span className="text-sm">A new version is available.</span>
      <button
        type="button"
        className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-label"
        onClick={() => (update ? void update(true) : window.location.reload())}
      >
        Update
      </button>
    </div>
  )
}
