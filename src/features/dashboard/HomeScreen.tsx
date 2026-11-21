import { useNavigate, useSearch } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useSpace } from '@/app/providers/SpaceProvider'
import { periodFromSearch, periodToSearch } from '@/shared/period'
import { cn } from '@/shared/ui/cn'
import { Page } from '@/shared/ui/Page'
import { PageGrid } from '@/shared/ui/PageGrid'
import { PeriodPicker } from '@/shared/ui/PeriodPicker'
import { STAGGER, staggerStyle } from '@/shared/ui/stagger'
import {
  AnalyticsCard,
  BreakdownCard,
  CalendarCard,
  GoalsCard,
  NetWorthCard,
  OverviewCard,
} from './cards'
import type { Range } from './search'
import { monthOf } from './search'

const cell = 'min-w-0'

/** The home dashboard. Everything on it is a function of the URL: period, calendar month and chart range. */
export function HomeScreen() {
  const { space } = useSpace()
  const search = useSearch({ from: '/_authed/s/$spaceId/' })
  const navigate = useNavigate()
  const period = periodFromSearch(search)
  const month = search.month ?? monthOf(new Date())
  const range: Range = search.range ?? '1M'

  const go = (patch: Partial<typeof search>) =>
    navigate({
      to: '/s/$spaceId',
      params: { spaceId: space.id },
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
    })

  return (
    <Page>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">Home</h1>
          <p data-testid="active-space" className="text-sm text-label-secondary">
            {space.avatarEmoji} {space.name} · {space.baseCurrency}
          </p>
        </div>
        <PeriodPicker
          value={period}
          onChange={(p) => {
            // Setting a preset clears any custom range, and the other way round.
            const next = periodToSearch(p)
            void go({ period: undefined, from: undefined, to: undefined, ...next })
          }}
        />
      </div>

      <PageGrid data-testid="home-grid">
        <div className={cn('lg:col-span-8 [&>*]:h-full', cell, STAGGER)} style={staggerStyle(0)}>
          <NetWorthCard range={range} onRange={(r) => go({ range: r === '1M' ? undefined : r })} />
        </div>
        <div
          className={cn('flex flex-col gap-4 lg:col-span-4 lg:gap-6', cell, STAGGER)}
          style={staggerStyle(1)}
        >
          <OverviewCard period={period} />
          <GoalsCard />
        </div>
        <div className={cn('lg:col-span-4 [&>*]:h-full', cell, STAGGER)} style={staggerStyle(2)}>
          <BreakdownCard period={period} />
        </div>
        <div className={cn('lg:col-span-4 [&>*]:h-full', cell, STAGGER)} style={staggerStyle(3)}>
          <AnalyticsCard period={period} />
        </div>
        <div className={cn('lg:col-span-4 [&>*]:h-full', cell, STAGGER)} style={staggerStyle(4)}>
          <CalendarCard
            month={month}
            onMonth={(m) => go({ month: m === monthOf(new Date()) ? undefined : m })}
          />
        </div>
      </PageGrid>
      <p className="sr-only">Today is {format(new Date(), 'd MMMM yyyy')}</p>
    </Page>
  )
}
