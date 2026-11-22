import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { components } from '@/shared/api/schema'
import { KeyboardModeProvider, usePrivacy } from '@/shared/ui/privacy'

export type PreferencesDTO = components['schemas']['users.PreferencesDTO']
export type KeyboardType = 'MINI_CALCULATOR' | 'STANDARD_NUMERIC'

export interface Preferences {
  hideAmounts: boolean
  keyboardType: KeyboardType
  appLockEnabled: boolean
}

interface PreferencesValue {
  preferences: Preferences
  /** Optimistic: applies immediately, rolls back if the server rejects it. */
  update: (patch: Partial<Pick<Preferences, 'hideAmounts' | 'keyboardType'>>) => void
}

const PreferencesContext = createContext<PreferencesValue | null>(null)

function toPreferences(dto: PreferencesDTO | undefined): Preferences {
  return {
    hideAmounts: dto?.hideAmounts ?? false,
    keyboardType: dto?.keyboardType === 'STANDARD_NUMERIC' ? 'STANDARD_NUMERIC' : 'MINI_CALCULATOR',
    appLockEnabled: dto?.appLockEnabled ?? false,
  }
}

export function usePreferencesQuery() {
  return useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: async () => (await api.GET('/me/preferences')).data ?? {},
    staleTime: 5 * 60_000,
  })
}

/**
 * Loads `GET /me/preferences` and feeds the values that drive the UI:
 * hide-amounts into the privacy context and the keyboard type into MoneyInput.
 * `fallback` renders until the preferences are known.
 */
export function PreferencesProvider({
  fallback,
  children,
}: {
  fallback: ReactNode
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const { data, isPending } = usePreferencesQuery()
  const { setHideAmounts } = usePrivacy()
  const preferences = useMemo(() => toPreferences(data), [data])

  // Keep the privacy context in step with the stored preference.
  useEffect(() => {
    setHideAmounts(preferences.hideAmounts)
  }, [preferences.hideAmounts, setHideAmounts])

  const mutation = useMutation({
    mutationFn: async (patch: Partial<PreferencesDTO>) =>
      (await api.PATCH('/me/preferences', { body: patch })).data,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.preferences() })
      const previous = queryClient.getQueryData<PreferencesDTO>(queryKeys.preferences())
      queryClient.setQueryData<PreferencesDTO>(queryKeys.preferences(), (old) => ({
        ...old,
        ...patch,
      }))
      return { previous }
    },
    onError: (_err, _patch, ctx) => {
      // Roll back; the global handler shows the toast.
      queryClient.setQueryData(queryKeys.preferences(), ctx?.previous)
    },
    onSuccess: (dto) => {
      if (dto) queryClient.setQueryData(queryKeys.preferences(), dto)
    },
  })

  const value = useMemo<PreferencesValue>(
    () => ({ preferences, update: (patch) => mutation.mutate(patch) }),
    [preferences, mutation],
  )

  if (isPending) return <>{fallback}</>
  return (
    <PreferencesContext.Provider value={value}>
      <KeyboardModeProvider
        mode={preferences.keyboardType === 'STANDARD_NUMERIC' ? 'numeric' : 'calculator'}
      >
        {children}
      </KeyboardModeProvider>
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>')
  return ctx
}
