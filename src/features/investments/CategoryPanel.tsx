import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { PieChart } from '@/shared/charts'
import { Amount } from '@/shared/ui/Amount'
import { cn } from '@/shared/ui/cn'
import { useLayout } from '@/shared/ui/layout'
import { InvestmentRow } from './InvestmentRow'
import type { InvestmentGroup, WrapperGroup } from './valuation'
import { baseValueOf, UNASSIGNED_KEY } from './valuation'
import { WrapperPercentInline } from './WrapperPercentInline'
import type { WrapperTarget } from './wrappers'

function itemSlices(w: WrapperGroup) {
  return w.items.flatMap((i) => {
    const b = baseValueOf(i)
    return b ? [{ key: i.id as string, name: i.name ?? '', amount: b.value }] : []
  })
}

function WrapperSection({
  group,
  wrapper: w,
  currency,
  spaceId,
  targets,
}: {
  group: InvestmentGroup
  wrapper: WrapperGroup
  currency: string | null
  spaceId: string
  targets: readonly WrapperTarget[]
}) {
  const [open, setOpen] = useState(true)
  const { isWide } = useLayout()
  const slices = itemSlices(w)
  const bodyId = `wrapper-${group.assetType}-${w.key}`.replace(/\W+/g, '-')
  return (
    <section
      aria-label={`${group.assetType} ${w.label}`}
      data-testid="wrapper-section"
      className="flex flex-col gap-2 border-t border-border pt-3"
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            aria-hidden
            className={cn('size-4 shrink-0 transition-transform', !open && '-rotate-90')}
          />
          <span className="truncate font-medium">{w.label}</span>
          {currency ? (
            <Amount value={w.value} currency={currency} className="ml-auto font-medium" />
          ) : null}
        </button>
        <WrapperPercentInline
          assetType={group.assetType}
          wrapperKey={w.key}
          wrapperLabel={w.label}
          actualPct={w.pctOfCategory}
          targets={targets}
          disabled={w.key === UNASSIGNED_KEY}
        />
        {isWide && slices.length > 0 ? (
          <PieChart
            slices={slices}
            currency={currency ?? ''}
            label={`${w.label} split by investment`}
            size={72}
            compact
          />
        ) : null}
      </div>
      {open ? (
        <div id={bodyId} className="flex flex-col gap-2 pl-6">
          {!isWide && slices.length > 1 ? (
            <PieChart
              slices={slices}
              currency={currency ?? ''}
              label={`${w.label} split by investment`}
              size={120}
              showAmounts={false}
            />
          ) : null}
          {w.items.map((i) => (
            <InvestmentRow key={i.id} investment={i} spaceId={spaceId} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

/** One asset type: "Crypto  IDR 900,000", then a section per wrapper (exchange, broker). */
export function CategoryPanel({
  group,
  label,
  spaceId,
  targets,
}: {
  group: InvestmentGroup
  label: string
  spaceId: string
  targets: readonly WrapperTarget[]
}) {
  const currency = group.currency
  return (
    <section
      aria-label={label}
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{label}</h2>
        {currency ? (
          <Amount value={group.value} currency={currency} className="text-lg font-semibold" />
        ) : null}
      </div>
      {group.wrappers.map((w) => (
        <WrapperSection
          key={w.key}
          group={group}
          wrapper={w}
          currency={currency}
          spaceId={spaceId}
          targets={targets}
        />
      ))}
    </section>
  )
}
