import { QueryClient } from '@tanstack/react-query'
import { invalidateMoney } from '@/shared/api/invalidate'
import { DEFAULT_PERIOD } from '@/shared/period'
import { dayOf, localDate, occurredAtFor } from './datetime'
import { editKindOf } from './EditTransactionSheet'
import {
  activeFilterCount,
  EMPTY_FILTERS,
  filtersFromSearch,
  filtersToApiQuery,
  filtersToSearch,
  hasAnyFilter,
  toggle,
  validateHistorySearch,
} from './filters'
import { toRows } from './HistoryScreen'
import { matchesFilters } from './optimistic'
import { impliedRate } from './TransferForm'

describe('history search params', () => {
  it('a plain history link has no params, and the default period is not written', () => {
    expect(validateHistorySearch({})).toEqual({})
    expect(filtersToSearch(EMPTY_FILTERS)).toEqual({})
  })

  it('round-trips period, query, categories and wallets through the URL', () => {
    const f = {
      period: { kind: 'range', from: '2026-10-01', to: '2026-10-31' } as const,
      q: 'coffee',
      categoryIds: ['c-1', 'c-2'],
      walletIds: ['w-1'],
    }
    const search = filtersToSearch(f)
    expect(search).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      q: 'coffee',
      categoryIds: ['c-1', 'c-2'],
      walletIds: ['w-1'],
    })
    expect(filtersFromSearch(search)).toEqual(f)
  })

  it('round-trips a preset and omits the default one', () => {
    const f = { ...EMPTY_FILTERS, period: { kind: 'preset', preset: 'LAST_7_DAYS' } as const }
    expect(filtersFromSearch(filtersToSearch(f))).toEqual(f)
    expect(filtersToSearch({ ...EMPTY_FILTERS, period: DEFAULT_PERIOD })).toEqual({})
  })

  it('sanitises hostile input', () => {
    const out = validateHistorySearch({
      q: `  ${'x'.repeat(500)}  `,
      categoryIds: ['ok-1', '<script>', 5, 'ok-1', '../../etc'],
      walletIds: 'single-id',
      period: 'NOPE',
      extra: 'x',
    })
    expect(out.q).toHaveLength(100)
    expect(out.categoryIds).toEqual(['ok-1'])
    expect(out.walletIds).toEqual(['single-id'])
    expect(out).not.toHaveProperty('period')
    expect(out).not.toHaveProperty('extra')
  })

  it('caps the number of ids', () => {
    const many = Array.from({ length: 500 }, (_, i) => `id-${i}`)
    expect(validateHistorySearch({ categoryIds: many }).categoryIds).toHaveLength(50)
  })

  it('counts the date range and each selected category and wallet, not search text', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: 'x' })).toBe(0)
    expect(activeFilterCount({ ...EMPTY_FILTERS, categoryIds: ['a', 'b'] })).toBe(2)
    expect(activeFilterCount({ ...EMPTY_FILTERS, categoryIds: ['a', 'b', 'c'] })).toBe(3)
    expect(
      activeFilterCount({
        period: { kind: 'preset', preset: 'TODAY' },
        q: '',
        categoryIds: ['a'],
        walletIds: ['w'],
      }),
    ).toBe(3)
    expect(hasAnyFilter({ ...EMPTY_FILTERS, q: 'x' })).toBe(true)
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false)
  })

  it('maps to the API query', () => {
    expect(filtersToApiQuery(EMPTY_FILTERS)).toEqual({ period: 'THIS_PERIOD' })
    expect(
      filtersToApiQuery({
        period: { kind: 'range', from: '2026-01-01', to: '2026-01-02' },
        q: ' tea ',
        categoryIds: ['c'],
        walletIds: ['w'],
      }),
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-02',
      q: 'tea',
      categoryIds: ['c'],
      walletIds: ['w'],
    })
  })

  it('toggles an id in and out', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggle(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('datetime', () => {
  it('formats the local calendar date', () => {
    expect(localDate(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05')
    expect(localDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })
  it('keeps the current time for today and uses midday for other days', () => {
    const now = new Date(2026, 10, 19, 15, 42, 7)
    expect(occurredAtFor('2026-11-19', now)).toBe(now.toISOString())
    const other = occurredAtFor('2026-11-10', now)
    expect(dayOf(other)).toBe('2026-11-10')
    expect(new Date(other).getHours()).toBe(12)
  })
})

describe('toRows (day grouping)', () => {
  const t = (id: string, iso: string) => ({ id, occurredAt: iso })
  it('adds one header per local day, in order', () => {
    const rows = toRows([
      t('1', new Date(2026, 10, 18, 12).toISOString()),
      t('2', new Date(2026, 10, 18, 9).toISOString()),
      t('3', new Date(2026, 10, 17, 20).toISOString()),
    ])
    expect(rows.map((r) => (r.kind === 'header' ? `H ${r.date}` : `T ${r.txn.id}`))).toEqual([
      'H 2026-11-18',
      'T 1',
      'T 2',
      'H 2026-11-17',
      'T 3',
    ])
  })
  it('handles an empty list', () => {
    expect(toRows([])).toEqual([])
  })
})

describe('optimistic matching', () => {
  const now = new Date(2026, 10, 19, 12)
  const item = {
    id: 'p',
    occurredAt: now.toISOString(),
    title: 'Latte',
    category: { id: 'c-1', name: 'Coffee' },
    wallet: { id: 'w-1', name: 'Cash' },
  }
  it('matches an unfiltered current-period view', () => {
    expect(matchesFilters(item, EMPTY_FILTERS, now)).toBe(true)
  })
  it('respects category, wallet and text filters', () => {
    expect(matchesFilters(item, { ...EMPTY_FILTERS, categoryIds: ['c-2'] }, now)).toBe(false)
    expect(matchesFilters(item, { ...EMPTY_FILTERS, categoryIds: ['c-1'] }, now)).toBe(true)
    expect(matchesFilters(item, { ...EMPTY_FILTERS, walletIds: ['w-9'] }, now)).toBe(false)
    expect(matchesFilters(item, { ...EMPTY_FILTERS, q: 'latte' }, now)).toBe(true)
    expect(matchesFilters(item, { ...EMPTY_FILTERS, q: 'tea' }, now)).toBe(false)
  })
  it('respects a custom range', () => {
    const f = {
      ...EMPTY_FILTERS,
      period: { kind: 'range', from: '2026-10-01', to: '2026-10-31' } as const,
    }
    expect(matchesFilters(item, f, now)).toBe(false)
  })
  it('does not insert a back-dated item into a preset view', () => {
    const old = { ...item, occurredAt: new Date(2026, 9, 1, 12).toISOString() }
    expect(matchesFilters(old, EMPTY_FILTERS, now)).toBe(false)
    expect(
      matchesFilters(
        old,
        { ...EMPTY_FILTERS, period: { kind: 'preset', preset: 'ALL_TIME' } },
        now,
      ),
    ).toBe(true)
  })
})

describe('editKindOf (USE_SPECIFIC_ENDPOINT rules)', () => {
  it('routes each transaction kind to the right editor', () => {
    expect(editKindOf({ type: 'EXPENSE' })).toBe('income-expense')
    expect(editKindOf({ type: 'INCOME' })).toBe('income-expense')
    expect(editKindOf({ type: 'ADJUSTMENT' })).toBe('note-only')
    expect(editKindOf({ type: 'OPENING_BALANCE' })).toBe('note-only')
    expect(editKindOf({ type: 'TRANSFER' })).toBe('transfer')
  })
  it('keeps trades and asset entries read-only here', () => {
    expect(editKindOf({ type: 'TRANSFER', investmentAction: 'BUY' })).toBe('read-only')
    expect(editKindOf({ type: 'TRANSFER', investment: { id: 'i' } })).toBe('read-only')
    expect(editKindOf({ type: 'TRANSFER', manualAsset: { id: 'a' } })).toBe('read-only')
    expect(editKindOf({})).toBe('read-only')
  })
})

describe('impliedRate', () => {
  it('divides received by sent, exactly', () => {
    expect(impliedRate('100', '1625000')?.toFixed()).toBe('16250')
    expect(impliedRate('3', '1')?.toFixed(4)).toBe('0.3333')
  })
  it('is null until both amounts are positive', () => {
    expect(impliedRate('', '5')).toBeNull()
    expect(impliedRate('5', '0')).toBeNull()
  })
})

describe('invalidateMoney', () => {
  it('invalidates wallets, investments, transactions, net worth, dashboard and goals together, for one space only', async () => {
    const qc = new QueryClient()
    const keys = [
      ['space', 's-1', 'wallets'],
      ['space', 's-1', 'transactions', { view: 'history' }],
      ['space', 's-1', 'net-worth'],
      ['space', 's-1', 'dashboard'],
      ['space', 's-1', 'goals'],
      ['space', 's-1', 'investments'],
      ['space', 's-1', 'manual-assets'],
      ['space', 's-1', 'categories'],
      ['space', 's-2', 'wallets'],
    ]
    for (const k of keys) qc.setQueryData(k, 1)
    await invalidateMoney(qc, 's-1')
    const stale = (k: unknown[]) => qc.getQueryState(k)?.isInvalidated
    for (const k of keys.slice(0, 7)) expect(stale(k), JSON.stringify(k)).toBe(true)
    expect(stale(keys[7] as unknown[])).toBe(false) // categories are not money
    expect(stale(keys[8] as unknown[])).toBe(false) // another space is untouched
  })
})
