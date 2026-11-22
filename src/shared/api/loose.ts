import { api } from './client'

/**
 * Calls for endpoints the generated `schema.d.ts` does not know yet (backend plan v2: wrappers,
 * assets summary, wallet display prefs). Same client, same auth and error handling; only the
 * typing is loosened. Remove a call from here once `pnpm sync:api` brings it into the schema.
 */
interface LooseInit {
  params?: { path?: Record<string, string>; query?: Record<string, unknown> }
  body?: unknown
}
interface LooseResult<T> {
  data?: T
}
type LooseFn = <T>(path: string, init?: LooseInit) => Promise<LooseResult<T>>

export const looseApi = api as unknown as {
  GET: LooseFn
  PATCH: LooseFn
  PUT: LooseFn
  POST: LooseFn
  DELETE: LooseFn
}
