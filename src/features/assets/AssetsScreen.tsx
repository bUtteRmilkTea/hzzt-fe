import { Link } from '@tanstack/react-router'
import { ChevronDown, Plus } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { useInvestments, useInvestmentTypes } from '@/features/investments/hooks'
import { useWallets } from '@/shared/api/wallets'
import { LineChart } from '@/shared/charts'
import { toMoneyString } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { cardClass } from '@/shared/ui/Card'
import { Collapsible } from '@/shared/ui/Collapsible'
import { cn } from '@/shared/ui/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Page } from '@/shared/ui/Page'
import { Skeleton } from '@/shared/ui/Skeleton'
import { TwoColumn } from '@/shared/ui/TwoColumn'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { AssetBreakdownList } from './AssetBreakdownList'
import { accountGroups, capEach, cashGroups } from './breakdown'
import { useManualAssets, useNetWorthHistory, useNetWorthSummary } from './hooks'
import { KINDS, type KindMeta } from './kinds'

/** "3 items · BCA": the count and the first item, as the server ordered them. Shown while a section is collapsed. */
export function collapsedSummary(names: readonly string[]): string {
  const first = names[0]
  if (first === undefined) return 'Empty'
  return `${names.length} ${names.length === 1 ? 'item' : 'items'} · ${first}`
}

function Section({
  title,
  total,
  currency,
  action,
  summary,
  children,
}: {
  title: string
  total: string
  currency: string
  action?: ReactNode
  /** Shown under the title while collapsed. */
  summary?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-border bg-surface-1 shadow-card"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              'size-5 text-label-secondary transition-transform',
              !open && '-rotate-90',
            )}
          />
          <span className="min-w-0">
            <span className="block font-semibold">{title}</span>
            {!open && summary ? (
              <span
                data-testid="section-summary"
                className="block truncate text-sm font-normal text-label-secondary"
              >
                {summary}
              </span>
            ) : null}
          </span>
        </button>
        <span className="font-semibold">
          <Amount animate value={total} currency={currency} />
        </span>
        {action}
      </div>
      <Collapsible open={open}>
        <div className="flex flex-col gap-2 border-t border-border p-4">{children}</div>
      </Collapsible>
    </section>
  )
}

function ManualSection({ meta, currency }: { meta: KindMeta; currency: string }) {
  const { space } = useSpace()
  const list = useManualAssets(space.id, meta.kind)
  return (
    <Section
      title={meta.section}
      total={list.data?.total.amount ?? '0'}
      currency={list.data?.total.currency || currency}
      summary={collapsedSummary((list.data?.items ?? []).map((a) => a.name ?? ''))}
      action={
        <Button variant="ghost" size="icon" aria-label={meta.addLabel} asChild>
          <Link
            to="/s/$spaceId/assets/new"
            params={{ spaceId: space.id }}
            search={{ kind: meta.kind }}
          >
            <Plus aria-hidden className="size-5" />
          </Link>
        </Button>
      }
    >
      {list.isPending ? (
        <Skeleton className="h-14" />
      ) : list.isError ? (
        <EmptyState
          title="Couldn't load this section"
          action={<Button onClick={() => void list.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <WarningsStrip warnings={list.data.total.warnings} />
          {list.data.items.length === 0 ? (
            <p className="text-sm text-label-secondary">{meta.emptyText}</p>
          ) : (
            <AssetBreakdownList
              groups={[
                {
                  key: meta.kind,
                  rows: list.data.items.map((a) => ({
                    key: a.id as string,
                    icon: a.icon,
                    name: a.name ?? '',
                    sub: a.counterpartyName,
                    value: toMoneyString(a.currentValue),
                    currency: a.currency ?? currency,
                    link: {
                      to: '/s/$spaceId/assets/$id',
                      params: { spaceId: space.id, id: a.id as string },
                    },
                  })),
                },
              ]}
            />
          )}
        </>
      )}
    </Section>
  )
}

const INLINE_INVESTMENTS = 5

/** Keeps the first `max` rows across groups, dropping groups that end up empty. */
export function capRows<G extends { rows: unknown[] }>(groups: readonly G[], max: number): G[] {
  let left = max
  const out: G[] = []
  for (const g of groups) {
    if (left <= 0) break
    const rows = g.rows.slice(0, left)
    left -= rows.length
    if (rows.length > 0) out.push({ ...g, rows })
  }
  return out
}

const kind = (k: KindMeta['kind']) => KINDS.find((m) => m.kind === k) as KindMeta

export function AssetsScreen() {
  const { space } = useSpace()
  const summary = useNetWorthSummary(space.id)
  const history = useNetWorthHistory(space.id, '1M')
  const cashOnly = space.trackingMode === 'CASH_ONLY'
  const wallets = useWallets(space.id)
  const investments = useInvestments(space.id, !cashOnly)
  const types = useInvestmentTypes()
  const typeLabel = (assetType: string) =>
    types.data?.find((t) => t.assetType === assetType)?.label ?? assetType
  const s = summary.data
  const change = history.data?.changePct
  const currency = s?.currency || space.baseCurrency

  const cash = s ? (
    <Section
      title="Cash"
      total={s.cash}
      currency={currency}
      summary={collapsedSummary((wallets.data?.items ?? []).map((w) => w.name ?? ''))}
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/s/$spaceId/wallets" params={{ spaceId: space.id }}>
            Wallets
          </Link>
        </Button>
      }
    >
      <p className="text-sm text-label-secondary">
        Everything in your wallets, converted to {currency}.
      </p>
      <AssetBreakdownList
        groups={cashGroups(wallets.data?.items ?? [], space.id)}
        empty={<p className="text-sm text-label-secondary">No wallets yet.</p>}
      />
    </Section>
  ) : null

  const allInvestmentGroups = accountGroups(investments.data?.items ?? [], typeLabel, space.id)
  const investmentRows = allInvestmentGroups.flatMap((g) => g.rows)
  const investmentsSection = s ? (
    <Section
      title="Investments"
      total={s.investments?.value ?? '0'}
      currency={currency}
      summary={collapsedSummary(investmentRows.map((r) => r.name))}
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/s/$spaceId/investments" params={{ spaceId: space.id }}>
            Open
          </Link>
        </Button>
      }
    >
      {s.investments ? (
        <p className="flex justify-between text-sm text-label-secondary">
          <span>
            Cost <Amount value={s.investments.cost} currency={s.currency} />
          </span>
          <span>
            <Amount
              value={s.investments.unrealizedPl}
              currency={s.currency}
              tone="auto"
              signDisplay="always"
            />
            {s.investments.unrealizedPlPct !== null ? (
              <> ({s.investments.unrealizedPlPct}%)</>
            ) : null}
          </span>
        </p>
      ) : null}
      <AssetBreakdownList
        groups={capEach(allInvestmentGroups, INLINE_INVESTMENTS)}
        empty={<p className="text-sm text-label-secondary">No investments yet.</p>}
      />
      {investmentRows.length > INLINE_INVESTMENTS ? (
        <Link
          to="/s/$spaceId/investments"
          params={{ spaceId: space.id }}
          className="px-2 py-2 text-sm font-medium text-accent"
        >
          Open all {investmentRows.length} investments
        </Link>
      ) : null}
    </Section>
  ) : null

  return (
    <Page>
      <h1 className="text-xl font-semibold">Assets</h1>

      {summary.isPending ? (
        <Skeleton className="h-24" />
      ) : summary.isError || !s ? (
        <EmptyState
          title="Couldn't load your net worth"
          action={<Button onClick={() => void summary.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <section
            aria-label={cashOnly ? 'Cash total' : 'Net worth'}
            className={cn(cardClass, 'flex flex-col gap-3')}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div>
                <p className="text-sm text-label-secondary">{cashOnly ? 'Cash' : 'Net worth'}</p>
                <p className="text-3xl font-semibold">
                  <Amount value={s.netWorth} currency={currency} animate />
                </p>
              </div>
              {change !== null && change !== undefined ? (
                <span
                  data-testid="networth-change"
                  className={cn(
                    'tabular text-sm font-medium',
                    change.startsWith('-') ? 'text-negative' : 'text-positive',
                  )}
                >
                  {change.startsWith('-') ? '' : '+'}
                  {change}% in the last month
                </span>
              ) : null}
            </div>
            <LineChart
              draw
              loading={history.isPending}
              height={180}
              data={(history.data?.points ?? []).map((p) => ({
                date: p.date,
                value: p.netWorth,
                live: p.live,
              }))}
              currency={history.data?.currency || currency}
              label="Net worth over the last month"
            />
          </section>
          <WarningsStrip warnings={s.warnings} />

          {cashOnly ? (
            cash
          ) : (
            <TwoColumn
              left={
                <>
                  {cash}
                  <ManualSection meta={kind('FIXED_ASSET')} currency={currency} />
                  <ManualSection meta={kind('LIABILITY')} currency={currency} />
                </>
              }
              right={
                <>
                  {investmentsSection}
                  <ManualSection meta={kind('RECEIVABLE')} currency={currency} />
                </>
              }
            />
          )}
        </>
      )}
    </Page>
  )
}
