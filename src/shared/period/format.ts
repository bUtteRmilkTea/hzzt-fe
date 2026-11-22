import { format, parseISO } from 'date-fns'
import { PERIOD_PRESETS, type Period } from './index'

/** Kept apart from ./index so route files (which load eagerly) never pull in date-fns. */
export function formatDay(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy')
}

export function periodLabel(p: Period): string {
  if (p.kind === 'preset') return PERIOD_PRESETS.find((x) => x.value === p.preset)?.label ?? ''
  return p.from === p.to ? formatDay(p.from) : `${formatDay(p.from)} – ${formatDay(p.to)}`
}
