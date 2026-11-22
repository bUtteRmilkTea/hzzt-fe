import { SegmentedControl } from './SegmentedControl'

export type SplitMode = 'class' | 'asset'

/** "By class" / "By asset": switches what a pie's slices are. */
export function SplitSwitch({
  value,
  onValueChange,
  className,
}: {
  value: SplitMode
  onValueChange: (mode: SplitMode) => void
  className?: string
}) {
  return (
    <SegmentedControl
      aria-label="Pie split"
      value={value}
      onValueChange={onValueChange}
      className={className ?? 'w-auto'}
      options={[
        { value: 'class', label: 'By class' },
        { value: 'asset', label: 'By asset' },
      ]}
    />
  )
}
