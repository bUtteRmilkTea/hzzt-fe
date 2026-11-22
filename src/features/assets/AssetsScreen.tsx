import { Link } from '@tanstack/react-router'
import { ChevronDown, Plus } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { useInvestments, useInvestmentTypes } from '@/features/investments/hooks'
import { useWallets } from '@/shared/api/wallets'
import { toMoneyString } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/ui/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Page } from '@/shared/ui/Page'
import { Skeleton } from '@/shared/ui/Skeleton'
import { StatCard } from '@/shared/ui/StatCard'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { AssetBreakdownList } from './AssetBreakdownList'
import { cashGroups, investmentGroups } from './breakdown'
import { useManualAssets, useNetWorthHistory, useNetWorthSummary } from './hooks'
import { KINDS, type KindMeta } from './kinds'

function Section({
  title,
  total,
  currency,
  action,
  children,
}: {
  title: string
  total: string
  currency: string
  action?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <section aria-label={title} className="rounded-lg border border-border bg-surface-1">
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
          <span className="font-semibold">{title}</span>
        </button>
        <span className="font-semibold">
          <Amount value={total} currency={currency} />
        </span>
        {action}
      </div>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-border p-4">{children}</div>
      ) : null}
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
          <StatCard
            label={cashOnly ? 'Cash' : 'Net worth'}
            value={
              <Amount
                value={s.netWorth}
                currency={s.currency || space.baseCurrency}
                className="text-3xl"
              />
            }
            note={
              change !== null && change !== undefined ? (
                <span
                  data-testid="networth-change"
                  className={cn(
                    'tabular font-medium',
                    change.startsWith('-') ? 'text-negative' : 'text-positive',
                  )}
                >
                  {change.startsWith('-') ? '' : '+'}
                  {change}% in the last month
                </span>
              ) : undefined
            }
          />
          <WarningsStrip warnings={s.warnings} />

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <Section
              title="Cash"
              total={s.cash}
              currency={s.currency || space.baseCurrency}
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/s/$spaceId/wallets" params={{ spaceId: space.id }}>
                    Wallets
                  </Link>
                </Button>
              }
            >
              <p className="text-sm text-label-secondary">
                Everything in your wallets, converted to {s.currency || space.baseCurrency}.
              </p>
              <AssetBreakdownList
                groups={cashGroups(wallets.data?.items ?? [], space.id)}
                empty={<p className="text-sm text-label-secondary">No wallets yet.</p>}
              />
            </Section>

            {cashOnly ? null : (
              <>
                <Section
                  title="Investments"
                  total={s.investments?.value ?? '0'}
                  currency={s.currency || space.baseCurrency}
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
                    groups={investmentGroups(investments.data?.items ?? [], typeLabel, space.id)}
                    empty={<p className="text-sm text-label-secondary">No investments yet.</p>}
                  />
                </Section>
                {KINDS.map((k) => (
                  <ManualSection
                    key={k.kind}
                    meta={k}
                    currency={s.currency || space.baseCurrency}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </Page>
  )
}
