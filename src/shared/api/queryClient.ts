import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { type AppError, errorMessage, logError, toAppError } from './errors'

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: AppError
    queryMeta: { silent?: boolean }
    mutationMeta: { silent?: boolean }
  }
}

/** Static catalogs (currencies, investment types, card presets) rarely change. */
export const STATIC_STALE_TIME = 5 * 60_000
export const LIST_STALE_TIME = 30_000

/** No retry on 4xx; one retry otherwise (plan 5.1). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const e = toAppError(error)
  if (e.status >= 400 && e.status < 500) return false
  return failureCount < 1
}

/**
 * `notify` is how failures reach the user (a toast). A 401 is never shown: the
 * client already refreshed or sent the user to /login. Validation errors are
 * rendered inline by the form, so they are not toasted either.
 */
export function createQueryClient(notify: (message: string) => void): QueryClient {
  const handle = (error: AppError, silent?: boolean) => {
    logError(error)
    if (silent || error.status === 401 || error.code === 'VALIDATION_FAILED') return
    notify(errorMessage(error))
  }

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => handle(error, query.meta?.silent),
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => handle(error, mutation.meta?.silent),
    }),
    defaultOptions: {
      queries: {
        staleTime: LIST_STALE_TIME,
        retry: shouldRetry,
        refetchOnWindowFocus: false, // turned on per query for money screens
      },
      // 'always': TanStack would otherwise PAUSE (queue) a write while offline. We refuse it with a clear
      // message instead (the API client throws OFFLINE), so the mutation must run and fail immediately.
      mutations: { retry: false, networkMode: 'always' },
    },
  })
}
