import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { components } from '@/shared/api/schema'
import { DEFAULT_SPACE_COLOR } from '@/shared/ui/palette'
import { useSession } from './SessionProvider'

export type SpaceDTO = components['schemas']['spaces.SpaceDTO']
export type TrackingMode = 'FULL_NET_WORTH' | 'CASH_ONLY'
export type SpaceRole = 'OWNER' | 'MEMBER'

/** The active space, with the fields the rest of the app relies on guaranteed present. */
export interface ActiveSpace {
  id: string
  name: string
  baseCurrency: string
  trackingMode: TrackingMode
  role: SpaceRole
  autoFxConversion: boolean
  avatarEmoji: string
  avatarColor: string
  memberCount: number
}

interface SpaceValue {
  spaces: readonly SpaceDTO[]
  space: ActiveSpace
  isOwner: boolean
  /** Switches space: tells the server, drops the old space's cache, navigates home. */
  switchSpace: (id: string) => Promise<void>
}

const SpaceContext = createContext<SpaceValue | null>(null)

export function toActiveSpace(dto: SpaceDTO): ActiveSpace {
  return {
    id: dto.id ?? '',
    name: dto.name ?? '',
    baseCurrency: dto.baseCurrency ?? 'IDR',
    trackingMode: dto.trackingMode === 'CASH_ONLY' ? 'CASH_ONLY' : 'FULL_NET_WORTH',
    role: dto.role === 'OWNER' ? 'OWNER' : 'MEMBER',
    autoFxConversion: dto.autoFxConversion ?? true,
    avatarEmoji: dto.avatarEmoji ?? '🏠',
    avatarColor: dto.avatarColor ?? DEFAULT_SPACE_COLOR,
    memberCount: dto.memberCount ?? 1,
  }
}

/**
 * Resolves the active space: the URL's `$spaceId` if it is one of mine, else the
 * server's `lastActiveSpaceId`, else the first space. Renders nothing until the
 * space list is known, so no screen ever paints without a space.
 */
export type SpaceFallback = 'loading' | 'empty' | 'error'

export function SpaceProvider({
  fallback,
  children,
}: {
  /** What to show until a space is available. `retry` refetches after an error. */
  fallback: (state: SpaceFallback, retry: () => void) => ReactNode
  children: ReactNode
}) {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { spaceId: urlSpaceId } = useParams({ strict: false }) as { spaceId?: string }

  const {
    data: spaces,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.spaces(),
    queryFn: async () => (await api.GET('/spaces')).data ?? [],
  })

  const activeDto = useMemo(() => {
    if (!spaces || spaces.length === 0) return undefined
    const byId = (id?: string) => (id ? spaces.find((s) => s.id === id) : undefined)
    return byId(urlSpaceId) ?? byId(user?.lastActiveSpaceId) ?? spaces[0]
  }, [spaces, urlSpaceId, user?.lastActiveSpaceId])

  const activeId = activeDto?.id
  const lastActivated = useRef<string | undefined>(user?.lastActiveSpaceId)
  const previousId = useRef<string | undefined>(undefined)

  // Remember the active space on the server, and drop the old space's cache entirely.
  useEffect(() => {
    if (!activeId) return
    if (previousId.current && previousId.current !== activeId) {
      queryClient.removeQueries({ queryKey: queryKeys.space(previousId.current).all() })
    }
    previousId.current = activeId
    if (lastActivated.current !== activeId) {
      lastActivated.current = activeId
      void api
        .POST('/spaces/{spaceId}/activate', { params: { path: { spaceId: activeId } } })
        .catch(() => {})
    }
  }, [activeId, queryClient])

  const switchSpace = useCallback(
    async (id: string) => {
      await navigate({ to: '/s/$spaceId', params: { spaceId: id } })
    },
    [navigate],
  )

  const value = useMemo<SpaceValue | null>(() => {
    if (!activeDto || !spaces) return null
    const space = toActiveSpace(activeDto)
    return { spaces, space, isOwner: space.role === 'OWNER', switchSpace }
  }, [activeDto, spaces, switchSpace])

  if (isPending) return <>{fallback('loading', () => void refetch())}</>
  if (isError) return <>{fallback('error', () => void refetch())}</>
  if (!value) return <>{fallback('empty', () => void refetch())}</>
  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>
}

export function useSpace(): SpaceValue {
  const ctx = useContext(SpaceContext)
  if (!ctx) throw new Error('useSpace must be used inside <SpaceProvider>')
  return ctx
}
