import { TriangleAlert } from 'lucide-react'

export interface ApiWarning {
  code?: string
  message?: string
}

/** Shown wherever the API returns `warnings[]` (for example a missing FX rate). Warnings never block. */
export function WarningsStrip({ warnings }: { warnings?: readonly ApiWarning[] }) {
  const items = (warnings ?? []).filter((w) => w.message || w.code)
  if (items.length === 0) return null
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-warning bg-surface-1 px-4 py-3 text-sm"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <ul className="flex flex-col gap-1">
        {items.map((w) => (
          <li key={`${w.code ?? ''}:${w.message ?? ''}`}>{w.message ?? w.code}</li>
        ))}
      </ul>
    </div>
  )
}
