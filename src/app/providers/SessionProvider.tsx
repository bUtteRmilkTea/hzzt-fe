import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { api, onSessionExpired, refreshSession, setAccessToken } from '@/shared/api/client'
import { AppError } from '@/shared/api/errors'
import type { components } from '@/shared/api/schema'

type UserDTO = components['schemas']['auth.UserDTO']
type AuthResponse = components['schemas']['auth.AuthResponse']

export interface SessionUser {
  id: string
  email: string
  name: string
  timezone: string
  lastActiveSpaceId: string | undefined
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface SessionValue {
  user: SessionUser | null
  status: SessionStatus
  /** Call after a successful login or register. */
  startSession: (auth: AuthResponse) => void
  logout: () => Promise<void>
  /** Replace the signed-in user's details, e.g. after editing the profile. */
  applyUser: (dto: UserDTO) => void
}

/** The backend declares every response field optional; the ones we rely on must be present. */
export function toSessionUser(dto: UserDTO | undefined): SessionUser {
  if (!dto?.id || !dto.email || !dto.name) {
    throw new AppError({ code: 'UNKNOWN_ERROR', message: 'Malformed user response', status: 0 })
  }
  return {
    id: dto.id,
    email: dto.email,
    name: dto.name,
    timezone: dto.timezone ?? 'UTC',
    lastActiveSpaceId: dto.lastActiveSpaceId || undefined,
  }
}

const SessionContext = createContext<SessionValue | null>(null)

// Boot runs once per page load. StrictMode's double effect shares this promise,
// so the rotating refresh token is never presented twice.
let bootPromise: Promise<SessionUser | null> | null = null

async function boot(): Promise<SessionUser | null> {
  const refreshed = await refreshSession()
  if (!refreshed) return null
  try {
    const { data } = await api.GET('/me')
    return toSessionUser(data)
  } catch {
    return null
  }
}

/** Test hook. */
export function resetSessionBoot() {
  bootPromise = null
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<SessionStatus>('loading')

  useEffect(() => {
    let cancelled = false
    bootPromise ??= boot()
    bootPromise.then((u) => {
      if (cancelled) return
      setUser(u)
      setStatus(u ? 'authenticated' : 'unauthenticated')
    })
    return () => {
      cancelled = true
    }
  }, [])

  // A failed refresh anywhere in the app clears the session.
  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear()
        setUser(null)
        setStatus('unauthenticated')
      }),
    [queryClient],
  )

  const startSession = useCallback((auth: AuthResponse) => {
    setAccessToken(auth.accessToken ?? null)
    setUser(toSessionUser(auth.user))
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.POST('/auth/logout')
    } catch {
      // Even if the server call fails, the local session ends.
    }
    setAccessToken(null)
    bootPromise = Promise.resolve(null)
    queryClient.clear()
    setUser(null)
    setStatus('unauthenticated')
  }, [queryClient])

  const applyUser = useCallback((dto: UserDTO) => setUser(toSessionUser(dto)), [])

  const value = useMemo(
    () => ({ user, status, startSession, logout, applyUser }),
    [user, status, startSession, logout, applyUser],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
