import type { SessionValue } from '@/app/providers/SessionProvider'

/** Available to every route's beforeLoad (route guards read the session from here). */
export interface RouterContext {
  session: SessionValue
}
