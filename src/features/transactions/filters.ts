import {
  DEFAULT_PERIOD,
  type Period,
  type PeriodSearch,
  periodFromSearch,
  periodsEqual,
  periodToApiQuery,
  periodToSearch,
  validatePeriodSearch,
} from '@/shared/period'

/** Everything the history view is a function of. It lives in the URL, so a link restores it exactly. */
export interface TransactionFilters {
  period: Period
  q: string
  categoryIds: string[]
  walletIds: string[]
}

export interface HistorySearch extends PeriodSearch {
  q?: string
  categoryIds?: string[]
  walletIds?: string[]
}

export const EMPTY_FILTERS: TransactionFilters = {
  period: DEFAULT_PERIOD,
  q: '',
  categoryIds: [],
  walletIds: [],
}

const MAX_IDS = 50
const ID = /^[\w-]{1,64}$/

function ids(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? [v] : []
  return [...new Set(list.filter((x): x is string => typeof x === 'string' && ID.test(x)))].slice(
    0,
    MAX_IDS,
  )
}

/** `validateSearch` for the history routes: untrusted URL in, clean typed search out. */
export function validateHistorySearch(search: object): HistorySearch {
  const raw = search as Record<string, unknown>
  const out: HistorySearch = validatePeriodSearch(raw)
  const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, 100) : ''
  const categoryIds = ids(raw.categoryIds)
  const walletIds = ids(raw.walletIds)
  if (q) out.q = q
  if (categoryIds.length) out.categoryIds = categoryIds
  if (walletIds.length) out.walletIds = walletIds
  return out
}

export function filtersFromSearch(search: object): TransactionFilters {
  const s = validateHistorySearch(search)
  return {
    period: periodFromSearch(s),
    q: s.q ?? '',
    categoryIds: s.categoryIds ?? [],
    walletIds: s.walletIds ?? [],
  }
}

/** Search params for a set of filters. Defaults are omitted so URLs stay short. */
export function filtersToSearch(f: TransactionFilters): HistorySearch {
  const out: HistorySearch = periodsEqual(f.period, DEFAULT_PERIOD) ? {} : periodToSearch(f.period)
  if (f.q.trim()) out.q = f.q.trim()
  if (f.categoryIds.length) out.categoryIds = f.categoryIds
  if (f.walletIds.length) out.walletIds = f.walletIds
  return out
}

/**
 * Number shown on the filter button ("Filters 3"): the date range when one is set, plus every
 * selected category and wallet. Search text is not counted.
 */
export function activeFilterCount(f: TransactionFilters): number {
  return (
    (periodsEqual(f.period, DEFAULT_PERIOD) ? 0 : 1) + f.categoryIds.length + f.walletIds.length
  )
}

export function hasAnyFilter(f: TransactionFilters): boolean {
  return activeFilterCount(f) > 0 || f.q.trim() !== ''
}

/** Query string params for the list and daily-summary endpoints. */
export function filtersToApiQuery(f: TransactionFilters) {
  return {
    ...periodToApiQuery(f.period),
    ...(f.q.trim() ? { q: f.q.trim() } : {}),
    ...(f.categoryIds.length ? { categoryIds: f.categoryIds } : {}),
    ...(f.walletIds.length ? { walletIds: f.walletIds } : {}),
  }
}

export function toggle(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}
