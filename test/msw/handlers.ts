import type { RequestHandler } from 'msw'
import { anonHandlers } from './api'

// Default: signed out. Tests call server.use(...authedHandlers) etc. to override.
export const handlers: RequestHandler[] = [...anonHandlers]
