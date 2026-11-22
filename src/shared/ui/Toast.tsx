import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ToastItem } from './ToastList'

type ToastTone = ToastItem['tone']

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void
}

// The animated list (and the motion engine behind it) loads on the first toast.
const ToastList = lazy(() => import('./ToastList'))

const ToastContext = createContext<ToastApi | null>(null)
const DURATION_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const [everShown, setEverShown] = useState(false)
  const nextId = useRef(0)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  // A toast timer that outlives the provider would set state after unmount (in tests, after the
  // DOM is torn down, which fails the whole run with "window is not defined").
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const t of pending) clearTimeout(t)
      pending.clear()
    }
  }, [])

  const show = useCallback((message: string, tone: ToastTone = 'default') => {
    const id = nextId.current++
    setEverShown(true)
    setItems((prev) => [...prev, { id, message, tone }])
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, DURATION_MS)
    timers.current.add(timer)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The aria-live region exists from the start so screen readers announce toasts. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),16px)]"
      >
        {everShown ? (
          <Suspense fallback={null}>
            <ToastList items={items} />
          </Suspense>
        ) : null}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
