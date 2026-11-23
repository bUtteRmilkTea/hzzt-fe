import { useState } from 'react'
import { errorMessage } from '@/shared/api/errors'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { type InstrumentKind, useInstrumentSearch } from './hooks'

export interface Instrument {
  instrumentId: string
  symbol: string
  name: string
}

interface InstrumentSearchProps {
  kind: InstrumentKind
  /** The chosen instrument, shown instead of the search results. */
  selected: Instrument | null
  onSelect: (i: Instrument | null) => void
  error?: string
}

/** Debounced market search. Auto pricing needs a chosen instrument, so the id is what this returns. */
export function InstrumentSearch({ kind, selected, onSelect, error }: InstrumentSearchProps) {
  const [text, setText] = useState('')
  const q = useDebounce(text, 300)
  const search = useInstrumentSearch(kind, q)

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
        <span>
          <span className="font-semibold">{selected.symbol}</span>{' '}
          <span className="text-label-secondary">{selected.name}</span>
        </span>
        <button
          type="button"
          className="min-h-12 px-2 text-sm font-medium text-accent"
          onClick={() => onSelect(null)}
        >
          Change
        </button>
      </div>
    )
  }

  const items = search.data ?? []
  return (
    <div className="flex flex-col gap-2">
      <Field
        label={
          kind === 'CRYPTO' ? 'Search coins' : kind === 'ETF' ? 'Search ETFs' : 'Search stocks'
        }
        error={error}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Name or symbol"
          autoComplete="off"
        />
      </Field>
      {q.trim().length >= 2 && search.isFetching ? (
        <p className="text-sm text-label-secondary">Searching…</p>
      ) : null}
      {search.isError ? (
        <p role="alert" className="text-sm text-negative">
          {errorMessage(search.error)}
        </p>
      ) : null}
      {q.trim().length >= 2 && search.isSuccess && items.length === 0 ? (
        <p className="text-sm text-label-secondary">No matches for “{q.trim()}”.</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface-1">
          {items.map((i) => (
            <li key={i.instrumentId}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-surface-3"
                onClick={() =>
                  onSelect({
                    instrumentId: i.instrumentId as string,
                    symbol: i.symbol ?? '',
                    name: i.name ?? '',
                  })
                }
              >
                <span className="font-semibold">{i.symbol}</span>
                <span className="truncate text-label-secondary">{i.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
