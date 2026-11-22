import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { api } from '@/shared/api/client'
import { errorMessage } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/queryKeys'
import { Decimal } from '@/shared/money'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Select } from '@/shared/ui/Select'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { useCurrencies, useManualRates } from './hooks'

/** A positive decimal rate, canonicalised as a string; null when invalid. */
export function parseRate(input: string): string | null {
  const v = input.trim()
  if (!/^\d+(\.\d+)?$/.test(v)) return null
  const d = new Decimal(v)
  return d.isZero() ? null : d.toFixed()
}

export function CurrencyScreen() {
  const { space, isOwner } = useSpace()
  const currencies = useCurrencies()

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <PageHeader title="Currency" backToSettings />
      <Card>
        <p className="text-sm text-label-secondary">Base currency</p>
        <p className="text-lg font-semibold">{space.baseCurrency}</p>
        <p className="mt-1 text-sm text-label-secondary">
          {space.autoFxConversion
            ? 'Exchange rates update automatically.'
            : 'Automatic conversion is off. Set your own rates below.'}
        </p>
      </Card>

      {space.autoFxConversion ? null : <ManualRates canEdit={isOwner} />}

      <section aria-labelledby="supported-heading" className="flex flex-col gap-3">
        <h2 id="supported-heading" className="text-lg font-semibold">
          Supported currencies
        </h2>
        {currencies.isPending ? (
          <Skeleton className="h-32" />
        ) : currencies.isError ? (
          <EmptyState
            title="Couldn't load currencies"
            action={<Button onClick={() => void currencies.refetch()}>Try again</Button>}
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-1">
            {currencies.data.map((c) => (
              <li key={c.code} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-medium">{c.code}</span>{' '}
                  <span className="text-label-secondary">{c.name}</span>
                </span>
                <span className="text-label-secondary">{c.symbol}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ManualRates({ canEdit }: { canEdit: boolean }) {
  const { space } = useSpace()
  const toast = useToast()
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const rates = useManualRates(space.id)
  const [base, setBase] = useState(space.baseCurrency)
  const [quote, setQuote] = useState('')
  const [rate, setRate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const key = queryKeys.space(space.id).manualRates()

  const put = useMutation({
    mutationFn: async (v: { base: string; quote: string; rate: string }) =>
      api.PUT('/spaces/{spaceId}/fx/manual-rates/{base}/{quote}', {
        params: { path: { spaceId: space.id, base: v.base, quote: v.quote } },
        body: { rate: v.rate },
      }),
    meta: { silent: true },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key })
      setRate('')
      toast.show('Rate saved', 'success')
    },
    onError: (err) => setError(errorMessage(err)),
  })
  const del = useMutation({
    mutationFn: async (v: { base: string; quote: string }) =>
      api.DELETE('/spaces/{spaceId}/fx/manual-rates/{base}/{quote}', {
        params: { path: { spaceId: space.id, ...v } },
      }),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  return (
    <section aria-labelledby="manual-heading" className="flex flex-col gap-3">
      <h2 id="manual-heading" className="text-lg font-semibold">
        Manual exchange rates
      </h2>

      {rates.isPending ? (
        <Skeleton className="h-16" />
      ) : rates.data && rates.data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rates.data.map((r) => (
            <li key={`${r.base}-${r.quote}`}>
              <Card className="flex items-center justify-between gap-3">
                <span className="tabular">
                  1 {r.base} = {r.rate} {r.quote}
                </span>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      r.base && r.quote && del.mutate({ base: r.base, quote: r.quote })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No manual rates yet"
          description="Add a rate for each currency pair you use."
        />
      )}

      {canEdit ? (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            const parsed = parseRate(rate)
            if (!quote || quote === base) return setError('Choose two different currencies.')
            if (!parsed) return setError('Enter a rate greater than zero.')
            put.mutate({ base, quote, rate: parsed })
          }}
        >
          {error ? (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Select value={base} onChange={(e) => setBase(e.target.value)}>
                {(currencies.data ?? []).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To">
              <Select value={quote} onChange={(e) => setQuote(e.target.value)}>
                <option value="">Choose…</option>
                {(currencies.data ?? []).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Rate" hint="How many of the second currency equal one of the first">
            <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <Button type="submit" disabled={put.isPending}>
            {put.isPending ? 'Saving…' : 'Save rate'}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-label-tertiary">
          Only the space owner can change exchange rates.
        </p>
      )}
    </section>
  )
}
