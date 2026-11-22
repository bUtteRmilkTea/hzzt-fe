import { Link, Outlet, useNavigate, useSearch } from '@tanstack/react-router'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { ListFilter, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { Page } from '@/shared/ui/Page'
import { PeriodPicker } from '@/shared/ui/PeriodPicker'
import { Skeleton } from '@/shared/ui/Skeleton'
import { DayGroupHeader, TransactionRow } from '@/shared/ui/TransactionRow'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { ActiveFilterChips } from './ActiveFilterChips'
import { dayOf } from './datetime'
import { activeFilterCount, filtersFromSearch, filtersToSearch, hasAnyFilter } from './filters'
import { HistorySummaryRail } from './HistorySummaryRail'
import { useDailySummary, useTransactions } from './hooks'
import type { PendingTransaction } from './optimistic'

const HEADER_PX = 44
const ROW_PX = 64
const PREFETCH_ROWS = 12

type Row =
  | { kind: 'header'; key: string; date: string }
  | { kind: 'txn'; key: string; txn: PendingTransaction }

/** Flatten pages into header + transaction rows, one header per local day. */
export function toRows(items: readonly PendingTransaction[]): Row[] {
  const rows: Row[] = []
  let lastDay = ''
  for (const txn of items) {
    const day = txn.occurredAt ? dayOf(txn.occurredAt) : ''
    if (day !== lastDay) {
      rows.push({ kind: 'header', key: `h-${day}`, date: day })
      lastDay = day
    }
    rows.push({ kind: 'txn', key: `t-${txn.id}`, txn })
  }
  return rows
}

export function HistoryScreen() {
  const { space } = useSpace()
  const search = useSearch({ from: '/_authed/s/$spaceId/history' })
  const navigate = useNavigate()
  const filters = useMemo(() => filtersFromSearch(search), [search])
  const txns = useTransactions(space.id, filters)
  const summary = useDailySummary(space.id, filters)

  // Search text: typed locally, written to the URL once the user pauses.
  const [text, setText] = useState(filters.q)
  const debounced = useDebounce(text, 300)
  useEffect(() => {
    if (debounced.trim() === filters.q) return
    void navigate({
      to: '/s/$spaceId/history',
      params: { spaceId: space.id },
      search: filtersToSearch({ ...filters, q: debounced }),
      replace: true,
    })
  }, [debounced, filters, navigate, space.id])

  const items = useMemo(() => txns.data?.pages.flatMap((p) => p.items) ?? [], [txns.data])
  const rows = useMemo(() => toRows(items), [items])
  const totals = useMemo(
    () => new Map((summary.data?.items ?? []).map((d) => [d.date, d])),
    [summary.data],
  )

  const listRef = useRef<HTMLDivElement>(null)
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i]?.kind === 'header' ? HEADER_PX : ROW_PX),
    overscan: 8,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  })
  const virtualItems = virtualizer.getVirtualItems()

  // Load the next page as the user nears the end of what is loaded.
  const lastIndex = virtualItems.at(-1)?.index ?? -1
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = txns
  useEffect(() => {
    if (lastIndex >= rows.length - PREFETCH_ROWS && hasNextPage && !isFetchingNextPage)
      void fetchNextPage()
  }, [lastIndex, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  const count = activeFilterCount(filters)
  const filtered = hasAnyFilter(filters)

  const writeFilters = (next: typeof filters) =>
    navigate({
      to: '/s/$spaceId/history',
      params: { spaceId: space.id },
      search: filtersToSearch(next),
      replace: true,
    })

  return (
    <Page className="flex-row gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h1 className="text-xl font-semibold">History</h1>

        <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-2 bg-bg px-4 py-2 lg:top-0 lg:mx-0 lg:px-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label-tertiary"
              />
              <Input
                type="search"
                aria-label="Search transactions"
                placeholder="Search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="pl-9"
              />
            </div>
            <PeriodPicker
              value={filters.period}
              onChange={(p) => writeFilters({ ...filters, period: p })}
            />
            <Link
              to="/s/$spaceId/history/filters"
              params={{ spaceId: space.id }}
              search={(prev) => prev}
              aria-label={count > 0 ? `Filters, ${count} active` : 'Filters'}
              className="relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-surface-1 px-4 text-sm font-medium"
            >
              <ListFilter aria-hidden className="size-4" />
              Filters
              {count > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-label">
                  {count}
                </span>
              ) : null}
            </Link>
          </div>
          <ActiveFilterChips spaceId={space.id} filters={filters} onChange={writeFilters} />
        </div>

        <WarningsStrip warnings={summary.data?.warnings} />

        {txns.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : txns.isError ? (
          <EmptyState
            title="Couldn't load your history"
            description="Check your connection and try again."
            action={<Button onClick={() => void txns.refetch()}>Try again</Button>}
          />
        ) : items.length === 0 ? (
          filters.q.trim() ? (
            <EmptyState
              title={`No results for “${filters.q.trim()}”`}
              description="Try a different word, or clear the filters."
            />
          ) : filtered ? (
            <EmptyState
              title="Nothing matches these filters"
              description="Try a longer period or fewer filters."
            />
          ) : (
            <EmptyState
              title="No transactions yet"
              description="Add your first expense or income to see it here."
              action={
                <Button asChild>
                  <Link
                    to="/s/$spaceId/transactions/new"
                    params={{ spaceId: space.id }}
                    search={{ type: 'EXPENSE' }}
                  >
                    Add transaction
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <div ref={listRef}>
            <ul
              aria-label="Transactions"
              className="list-none"
              style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
            >
              {virtualItems.map((v) => {
                const row = rows[v.index]
                if (!row) return null
                const day = row.kind === 'header' ? totals.get(row.date) : undefined
                return (
                  <li
                    key={row.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: v.size,
                      transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)`,
                    }}
                  >
                    {row.kind === 'header' ? (
                      <DayGroupHeader
                        date={row.date}
                        sticky={false}
                        level={2}
                        income={day?.income}
                        expense={day?.expense}
                        currency={summary.data?.currency}
                      />
                    ) : (
                      <Link
                        to="/s/$spaceId/transactions/$id"
                        params={{ spaceId: space.id, id: row.txn.id as string }}
                        className="block border-b border-border"
                      >
                        <TransactionRow
                          transaction={row.txn}
                          pending={row.txn.pending}
                          showWallet
                        />
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
            {isFetchingNextPage ? <Skeleton className="mt-2 h-14" /> : null}
          </div>
        )}

        <Outlet />
      </div>
      <HistorySummaryRail period={filters.period} />
    </Page>
  )
}
