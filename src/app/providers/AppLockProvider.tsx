import { useMutation } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { PinPad } from '@/features/preferences/PinPad'
import { formatCountdown, isValidPin, retryAfterSeconds } from '@/features/preferences/pin'
import { api } from '@/shared/api/client'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { usePreferences } from './PreferencesProvider'

/**
 * The app-lock gate: a UI overlay shown on boot and whenever the tab becomes visible
 * again, while app lock is enabled. It is explicitly NOT a security boundary: it
 * guards the screen, not the data. The PIN is checked by the server
 * (`POST /me/app-lock/verify`), including the lockout.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const {
    preferences: { appLockEnabled },
  } = usePreferences()
  const [locked, setLocked] = useState(appLockEnabled)

  // Lock when the feature is switched on elsewhere? No: enabling it should not lock you out
  // of the screen you are on. It applies on the next boot or tab return.
  useEffect(() => {
    if (!appLockEnabled) setLocked(false)
  }, [appLockEnabled])

  useEffect(() => {
    if (!appLockEnabled) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') setLocked(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [appLockEnabled])

  const unlock = useCallback(() => setLocked(false), [])

  return (
    <>
      {/* inert keeps focus and assistive tech out of the content while locked */}
      <div inert={locked} aria-hidden={locked || undefined}>
        {children}
      </div>
      {locked ? <LockScreen onUnlock={unlock} /> : null}
    </>
  )
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  // Deadline (epoch ms) from the server's retryAfter, so the countdown is the server's number.
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (lockedUntil === null) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= lockedUntil) {
        setLockedUntil(null)
        setMessage(null)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  const verify = useMutation({
    mutationFn: async (value: string) =>
      (await api.POST('/me/app-lock/verify', { body: { pin: value } })).data,
    meta: { silent: true },
    onSuccess: (data) => {
      if (data?.valid) {
        onUnlock()
        return
      }
      setPin('')
      setMessage('That PIN is incorrect.')
    },
    onError: (err) => {
      setPin('')
      const e = toAppError(err)
      const secs = retryAfterSeconds(e.details)
      if (e.code === 'APP_LOCK_TEMPORARILY_LOCKED' && secs) {
        const t = Date.now()
        setNow(t)
        setLockedUntil(t + secs * 1000)
        setMessage(null)
        return
      }
      if (e.code === 'APP_LOCK_NOT_ENABLED') {
        onUnlock()
        return
      }
      setMessage(errorMessage(e))
    },
  })

  const remaining = lockedUntil === null ? 0 : Math.max(0, Math.ceil((lockedUntil - now) / 1000))
  const lockedOut = remaining > 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App locked"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-bg px-6"
    >
      <div className="text-center">
        <h1 className="text-xl font-medium">Enter your PIN</h1>
        <p className="mt-1 text-sm text-label-secondary">HZZT is locked</p>
      </div>

      <PinPad value={pin} onChange={setPin} disabled={lockedOut || verify.isPending} />

      <div className="min-h-12 text-center" aria-live="polite">
        {lockedOut ? (
          <p role="alert" className="text-negative">
            Too many wrong PINs. Try again in{' '}
            <span className="tabular font-semibold">{formatCountdown(remaining)}</span>
          </p>
        ) : message ? (
          <p role="alert" className="text-negative">
            {message}
          </p>
        ) : null}
      </div>

      <Button
        disabled={!isValidPin(pin) || lockedOut || verify.isPending}
        onClick={() => verify.mutate(pin)}
        className="w-64"
      >
        {verify.isPending ? 'Checking…' : 'Unlock'}
      </Button>
      <p className="max-w-xs text-center text-xs text-label-tertiary">
        This lock guards the screen on this device. It does not encrypt your data.
      </p>
    </div>
  )
}
