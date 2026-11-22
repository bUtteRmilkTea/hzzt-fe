import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Amount } from '@/shared/ui/Amount'
import { cardClass } from '@/shared/ui/Card'
import { Collapsible } from '@/shared/ui/Collapsible'
import { cn } from '@/shared/ui/cn'
import { STAGGER, staggerStyle } from '@/shared/ui/stagger'
import { InvestmentRow } from './InvestmentRow'
import { TargetBar } from './TargetBar'
import type { InvestmentGroup, WrapperGroup } from './valuation'
import { UNASSIGNED_KEY } from './valuation'
import { WrapperPercentInline } from './WrapperPercentInline'
import type { WrapperTarget } from './wrappers'

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
  const target = targets.find((t) => t.assetType === group.assetType && t.key === w.key)
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
      </div>
      {w.key === UNASSIGNED_KEY ? null : (
        <TargetBar
          label={w.label}
          actualPct={w.pctOfCategory}
          targetPct={target?.targetPct ?? null}
        />
      )}
      <Collapsible open={open} id={bodyId}>
        <div className="flex flex-col pl-6">
          {w.items.map((i, n) => (
            <div key={i.id} className={STAGGER} style={staggerStyle(n)}>
              <InvestmentRow investment={i} spaceId={spaceId} />
            </div>
          ))}
        </div>
      </Collapsible>
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
    <section aria-label={label} className={cn(cardClass, 'flex flex-col gap-3')}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">{label}</h2>
        {currency ? (
          <Amount animate value={group.value} currency={currency} className="text-lg font-medium" />
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
