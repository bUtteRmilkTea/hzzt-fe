import { Link } from '@tanstack/react-router'
import { Mail, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { PieChart } from '@/shared/charts'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { SplitSwitch } from '@/shared/ui/SplitSwitch'
import { useSplitMode } from '@/shared/ui/useSplitMode'
import { TwoColumn } from '@/shared/ui/TwoColumn'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { CategoryPanel } from './CategoryPanel'
import { useInvestments, useInvestmentTypes } from './hooks'
import { categorySlices, groupInvestments, topSlices } from './valuation'
import { useWrapperTargets } from './wrappers'

export function InvestmentsScreen() {
  const { space } = useSpace()
  const list = useInvestments(space.id)
  const types = useInvestmentTypes()
  const targets = useWrapperTargets(space.id)
  const groups = useMemo(() => groupInvestments(list.data?.items ?? []), [list.data])
  const [mode, setMode] = useSplitMode('investments-pie-mode')
  const label = (assetType: string) =>
    types.data?.find((t) => t.assetType === assetType)?.label ?? assetType
  const pieSlices = useMemo(
    () =>
      mode === 'class'
        ? categorySlices(list.data?.items ?? [], label)
        : topSlices(list.data?.items ?? []),
    // biome-ignore lint/correctness/useExhaustiveDependencies: label only changes with types.data
    [list.data, mode, types.data],
  )

  const panel = (g: (typeof groups)[number]) => (
    <CategoryPanel
      key={g.key}
      group={g}
      label={label(g.assetType)}
      spaceId={space.id}
      targets={targets.data?.items ?? []}
    />
  )

  return (
    <Page>
      <PageHeader
        title="Investments"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" aria-label="Shared investment invitations" asChild>
              <Link to="/invitations/shared">
                <Mail aria-hidden className="size-5" />
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/s/$spaceId/investments/new" params={{ spaceId: space.id }}>
                <Plus aria-hidden className="size-4" />
                Add
              </Link>
            </Button>
          </div>
        }
      />

      {list.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : list.isError ? (
        <EmptyState
          title="Couldn't load your investments"
          action={<Button onClick={() => void list.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <Card
            data-testid="portfolio-summary"
            className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1 lg:w-2/5">
              <p className="text-sm text-label-secondary">Portfolio value</p>
              <p className="text-3xl font-medium">
                <Amount
                  animate
                  value={list.data.summary.totalValue}
                  currency={list.data.summary.currency || space.baseCurrency}
                />
              </p>
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-label-secondary">
                <span data-testid="portfolio-pl" className="font-medium">
                  <Amount
                    value={list.data.summary.unrealizedPl}
                    currency={list.data.summary.currency || space.baseCurrency}
                    tone="auto"
                    signDisplay="always"
                  />
                  {list.data.summary.unrealizedPlPct !== null ? (
                    <> ({list.data.summary.unrealizedPlPct}%)</>
                  ) : null}
                </span>
                <span>
                  Cost{' '}
                  <Amount
                    value={list.data.summary.totalCost}
                    currency={list.data.summary.currency || space.baseCurrency}
                  />
                </span>
              </p>
            </div>
            {pieSlices.length > 0 ? (
              <section
                aria-label="Portfolio split"
                className="flex min-w-0 flex-col gap-3 lg:w-3/5"
              >
                <SplitSwitch value={mode} onValueChange={setMode} />
                <PieChart
                  key={mode}
                  donut
                  draw
                  layout="row"
                  size={152}
                  slices={pieSlices}
                  currency={list.data.summary.currency || space.baseCurrency}
                  label={
                    mode === 'class'
                      ? 'Portfolio split by asset class'
                      : 'Portfolio split by investment'
                  }
                />
              </section>
            ) : null}
          </Card>
          <WarningsStrip warnings={list.data.summary.warnings} />

          {list.data.items.length === 0 ? (
            <EmptyState
              title="No investments yet"
              description="Track crypto, stocks, funds and ETFs in one place."
              action={
                <Button asChild>
                  <Link to="/s/$spaceId/investments/new" params={{ spaceId: space.id }}>
                    Add investment
                  </Link>
                </Button>
              }
            />
          ) : (
            <TwoColumn
              left={groups.filter((_, i) => i % 2 === 0).map((g) => panel(g))}
              right={groups.filter((_, i) => i % 2 === 1).map((g) => panel(g))}
            />
          )}
        </>
      )}
    </Page>
  )
}
