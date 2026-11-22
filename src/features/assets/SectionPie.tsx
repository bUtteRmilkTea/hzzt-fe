import { PieChart, type PieSlice } from '@/shared/charts'

/**
 * A small donut for one Assets section. Hidden with fewer than two slices (one slice is just a
 * circle). `skipped` counts items left out because they have no base-currency value (no client FX).
 */
export function SectionPie({
  slices,
  currency,
  label,
  skipped = 0,
}: {
  slices: readonly PieSlice[]
  currency: string
  label: string
  skipped?: number
}) {
  if (slices.length < 2) return null
  return (
    <div data-testid="section-pie" className="flex flex-col gap-1 pb-2">
      <PieChart
        donut
        draw
        layout="row"
        size={120}
        slices={slices}
        currency={currency}
        label={label}
        showAmounts={false}
      />
      {skipped > 0 ? (
        <p className="text-xs text-label-tertiary" data-testid="section-pie-skipped">
          {skipped} {skipped === 1 ? 'item' : 'items'} in other currencies not shown
        </p>
      ) : null}
    </div>
  )
}
