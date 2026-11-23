import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useSpace } from '@/app/providers/SpaceProvider'
import { useCurrencies } from '@/features/spaces/hooks'
import { errorMessage, fieldErrors } from '@/shared/api/errors'
import { useWallets } from '@/shared/api/wallets'
import { currencyPrefix } from '@/shared/money'
import { Button, DisabledReason } from '@/shared/ui/Button'
import { EmojiPopover } from '@/shared/ui/EmojiPopover'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { Select } from '@/shared/ui/Select'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Switch } from '@/shared/ui/Switch'
import { useToast } from '@/shared/ui/Toast'
import {
  type InstrumentKind,
  useCreateInvestment,
  useFxLatest,
  useInvestments,
  useInvestmentTypes,
} from './hooks'
import { type Instrument, InstrumentSearch } from './InstrumentSearch'
import { buildTypeSchema, derivedShares, type TypeFormValues, toCreateBody } from './schema'
import type { TypeMeta } from './types'
import { groupInvestments, UNASSIGNED_KEY } from './valuation'

const kindFor = (assetType: string): InstrumentKind =>
  assetType === 'CRYPTO' ? 'CRYPTO' : assetType === 'GLOBAL_ETF' ? 'ETF' : 'STOCK'

export function CreateInvestmentScreen() {
  const types = useInvestmentTypes()
  const [assetType, setAssetType] = useState<string | null>(null)
  const metas = types.data ?? []
  const meta = metas.find((m) => m.assetType === (assetType ?? metas[0]?.assetType))

  return (
    <Page width="wide" gap={5}>
      <PageHeader title="Add investment" />
      {types.isPending ? (
        <Skeleton className="h-64" />
      ) : types.isError || !meta ? (
        <EmptyState
          title="Couldn't load investment types"
          action={<Button onClick={() => void types.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <Field label="Type">
            <Select value={meta.assetType} onChange={(e) => setAssetType(e.target.value)}>
              {metas.map((m) => (
                <option key={m.assetType} value={m.assetType}>
                  {m.defaultIcon} {m.label}
                </option>
              ))}
            </Select>
          </Field>
          {/* Remount per type: each type has its own schema and defaults. */}
          <TypeForm key={meta.assetType} meta={meta} />
        </>
      )}
    </Page>
  )
}

/** Two columns from 1024px (plan F13-T05); one column below. */
const PAIR = 'grid grid-cols-1 gap-4 lg:grid-cols-2'

/**
 * A sticky card that echoes what has been typed, in the same style as a list row. It shows no
 * computed totals: money is never computed in the client (plan 5.2, D-F17).
 */
function SummaryRail({
  meta,
  name,
  symbol,
  icon,
  wrapper,
}: {
  meta: TypeMeta
  name?: string | undefined
  symbol?: string | undefined
  icon?: string | undefined
  wrapper?: string | undefined
}) {
  const { space } = useSpace()
  const list = useInvestments(space.id)
  // The latest holdings of this type: context for the form, and it keeps the rail from being a stub.
  const recent = (list.data?.items ?? []).filter((i) => i.assetType === meta.assetType).slice(0, 3)
  return (
    <aside
      aria-label="Summary"
      data-testid="summary-rail"
      className="sticky top-4 hidden flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4 lg:flex"
    >
      <p className="text-sm text-label-secondary">{meta.label}</p>
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-2xl">
          {icon || meta.defaultIcon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" data-testid="rail-name">
            {name?.trim() || 'Name'}
          </p>
          <p className="truncate text-sm text-label-secondary" data-testid="rail-symbol">
            {symbol?.trim() || 'Symbol'}
          </p>
        </div>
      </div>
      {wrapper?.trim() ? (
        <p className="border-t border-border pt-3 text-sm text-label-secondary">
          In <span className="font-medium text-label">{wrapper.trim()}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-2 border-t border-border pt-3" data-testid="rail-recent">
        <h2 className="text-sm font-semibold text-label-secondary">Your {meta.label}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-label-tertiary">
            {list.isPending ? 'Loading…' : `Nothing here yet. This will be your first.`}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recent.map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-sm">
                <span aria-hidden>{i.icon}</span>
                <span className="min-w-0 flex-1 truncate">{i.name}</span>
                <span className="text-label-secondary">{i.symbol}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

const NEW_WRAPPER = '__new__'

/** Pick an existing exchange/broker for this asset type, or type a new one inline. */
function WrapperField({
  assetType,
  value,
  onChange,
  error,
}: {
  assetType: string
  value: string
  onChange: (v: string) => void
  error?: string | undefined
}) {
  const { space } = useSpace()
  const list = useInvestments(space.id)
  const existing = useMemo(() => {
    const g = groupInvestments(list.data?.items ?? []).find((x) => x.assetType === assetType)
    return (g?.wrappers ?? []).filter((w) => w.key !== UNASSIGNED_KEY).map((w) => w.label)
  }, [list.data, assetType])
  const [creating, setCreating] = useState(false)
  const selectValue = creating ? NEW_WRAPPER : existing.includes(value) ? value : ''
  return (
    <div className="flex flex-col gap-2">
      <Field label="Exchange / broker (optional)" error={creating ? undefined : error}>
        <Select
          value={selectValue}
          onChange={(e) => {
            if (e.target.value === NEW_WRAPPER) {
              setCreating(true)
              onChange('')
            } else {
              setCreating(false)
              onChange(e.target.value)
            }
          }}
        >
          <option value="">None</option>
          {existing.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
          <option value={NEW_WRAPPER}>New wrapper…</option>
        </Select>
      </Field>
      {creating ? (
        <Field label="New wrapper name" error={error}>
          <Input maxLength={60} value={value} onChange={(e) => onChange(e.target.value)} />
        </Field>
      ) : null}
    </div>
  )
}

/** "16250.5" -> "16,250.5" (the server's figure, only grouped for reading). */
function groupThousands(v: string | undefined): string | null {
  if (!v || !/^\d+(\.\d+)?$/.test(v)) return null
  const [int = '', frac] = v.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${grouped}.${frac.slice(0, 4).replace(/0+$/, '')}`.replace(/\.$/, '') : grouped
}

/**
 * A quantity is a count of units, not money: it must never be rounded to a currency's decimals.
 * Keep digits and a single decimal point (a comma counts as the point); the server's limit
 * (`quantityScale`) is reported by validation, not enforced by dropping typed digits.
 */
export function cleanQuantity(raw: string): string {
  const v = raw.replace(',', '.').replace(/[^\d.]/g, '')
  const i = v.indexOf('.')
  return i < 0 ? v : `${v.slice(0, i + 1)}${v.slice(i + 1).replace(/\./g, '')}`
}

function emptyValues(meta: TypeMeta): TypeFormValues {
  const details: Record<string, string> = {}
  for (const f of meta.detailFields ?? []) if (f.name) details[f.name] = ''
  return {
    assetType: meta.assetType,
    name: '',
    symbol: '',
    icon: meta.defaultIcon ?? '💼',
    // Auto when the type can be priced by the market, else Manual (F34-T03).
    priceMode: meta.supportsAutoPrice ? 'AUTO' : 'MANUAL',
    instrumentId: '',
    quantity: '',
    avgBuyPrice: '',
    manualPrice: '',
    manualCurrentValue: '',
    fees: '',
    manualFxRate: '',
    // Empty by default: there is no assumed return (F34-T05).
    estimatedAnnualChangePct: '',
    quoteCurrency: meta.quoteCurrency ?? '',
    purchaseDate: '',
    wrapper: '',
    fundingWalletId: '',
    fundingAmount: '',
    details,
  } as unknown as TypeFormValues
}

function TypeForm({ meta }: { meta: TypeMeta }) {
  const { space } = useSpace()
  const navigate = useNavigate()
  const toast = useToast()
  const create = useCreateInvestment()
  const wallets = useWallets(space.id)
  const currencies = useCurrencies()
  const schema = useMemo(() => buildTypeSchema(meta), [meta])
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const lots = meta.quantityMode === 'LOTS'
  const quote = meta.quoteCurrency ?? space.baseCurrency

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<TypeFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: emptyValues(meta),
  })

  const priceMode = useWatch({ control, name: 'priceMode' })
  const lotsValue = useWatch({ control, name: 'details' } as never) as unknown as
    | Record<string, string>
    | undefined
  const manualValue = useWatch({ control, name: 'manualCurrentValue' } as never) as unknown as
    | string
    | undefined
  const hasManualValue = (manualValue ?? '').trim() !== ''
  const [ownRate, setOwnRate] = useState(false)
  const fx = useFxLatest(quote, quote !== space.baseCurrency)
  const providerRate = groupThousands(fx.data?.rates?.[space.baseCurrency])
  const shares = lots ? derivedShares(lotsValue?.lots ?? '', meta.lotSize) : null
  const err = errors as unknown as Record<
    string,
    { message?: string } & Record<string, { message?: string }>
  >

  const pick = (i: Instrument | null) => {
    setInstrument(i)
    setValue('instrumentId', i?.instrumentId ?? '', { shouldValidate: true })
    if (i) {
      setValue('symbol', i.symbol)
      setValue('name', i.name)
    }
  }

  const onSubmit = handleSubmit((v) => {
    setFormError(null)
    create.mutate(toCreateBody(v, meta), {
      onSuccess: (inv) => {
        toast.show('Investment added', 'success')
        void navigate({
          to: '/s/$spaceId/investments/$id',
          params: { spaceId: space.id, id: inv?.id as string },
        })
      },
      onError: (e) => {
        const fields = fieldErrors(e)
        let mapped = 0
        for (const [name, message] of Object.entries(fields)) {
          setError(name as never, { type: 'server', message })
          mapped++
        }
        setFormError(mapped ? null : errorMessage(e))
      },
    })
  })

  const detailInput = (f: NonNullable<TypeMeta['detailFields']>[number]) => {
    const name = `details.${f.name}` as never
    const message = (errors as unknown as { details?: Record<string, { message?: string }> })
      .details?.[f.name ?? '']?.message
    if (f.kind === 'ENUM') {
      return (
        <Field key={f.name} label={f.label ?? ''} error={message}>
          <Select {...register(name)}>
            <option value="">Choose…</option>
            {(f.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
      )
    }
    return (
      <Field key={f.name} label={`${f.label}${f.required ? '' : ' (optional)'}`} error={message}>
        <Input
          type={f.kind === 'DATE' ? 'date' : 'text'}
          inputMode={
            f.kind === 'INTEGER' ? 'numeric' : f.kind === 'DECIMAL' ? 'decimal' : undefined
          }
          {...register(name)}
        />
      </Field>
    )
  }

  const watched = useWatch({ control }) as unknown as {
    name?: string
    symbol?: string
    icon?: string
    wrapper?: string
  }

  const nameFilled = Boolean(watched.name?.trim())

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {formError ? (
          <p role="alert" className="text-sm text-negative">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Controller
            control={control}
            name="priceMode"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Pricing"
                value={field.value}
                onValueChange={(m) => {
                  field.onChange(m)
                  if (m === 'MANUAL') pick(null)
                }}
                options={[
                  { value: 'AUTO', label: 'Auto', disabled: !meta.supportsAutoPrice },
                  { value: 'MANUAL', label: 'Manual' },
                ]}
              />
            )}
          />
          {!meta.supportsAutoPrice ? (
            <p className="text-sm text-label-secondary">
              Automatic pricing isn't available for {meta.label?.toLowerCase()}, so enter the price
              yourself.
            </p>
          ) : null}
          {err.priceMode?.message ? (
            <p role="alert" className="text-sm text-negative">
              {err.priceMode.message}
            </p>
          ) : null}
        </div>

        {priceMode === 'AUTO' && meta.supportsAutoPrice ? (
          <InstrumentSearch
            kind={kindFor(meta.assetType as string)}
            selected={instrument}
            onSelect={pick}
            error={err.instrumentId?.message}
          />
        ) : null}

        <div className={PAIR}>
          <div className="flex items-end gap-3">
            <Controller
              control={control}
              name="icon"
              render={({ field }) => (
                <EmojiPopover label="Icon" value={field.value} onChange={field.onChange} />
              )}
            />
            <Field label="Name" error={err.name?.message} className="min-w-0 flex-1">
              <Input maxLength={60} {...register('name')} />
            </Field>
          </div>
          <Field
            label={`Symbol${meta.symbolRequired ? '' : ' (optional)'}`}
            error={err.symbol?.message}
          >
            <Input maxLength={20} autoCapitalize="characters" {...register('symbol')} />
          </Field>
        </div>

        <div className={PAIR}>
          {lots ? (
            <div className="flex flex-col gap-2">
              {(meta.detailFields ?? []).filter((f) => f.name === 'lots').map(detailInput)}
              <p className="text-sm text-label-secondary" data-testid="derived-shares">
                {shares
                  ? `= ${shares} shares (1 lot = ${meta.lotSize ?? 100} shares)`
                  : `1 lot = ${meta.lotSize ?? 100} shares`}
              </p>
            </div>
          ) : (
            <Controller
              control={control}
              name="quantity"
              render={({ field }) => (
                <Field label="Quantity" error={err.quantity?.message}>
                  <Input
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    invalid={Boolean(err.quantity)}
                    className="tabular text-right"
                    value={field.value}
                    onChange={(e) => field.onChange(cleanQuantity(e.target.value))}
                    onBlur={field.onBlur}
                  />
                </Field>
              )}
            />
          )}
          <Field label="Average buy price" error={err.avgBuyPrice?.message}>
            <Input
              prefix={currencyPrefix(quote)}
              inputMode="decimal"
              {...register('avgBuyPrice')}
            />
          </Field>

          {priceMode === 'MANUAL' ? (
            <Field
              label={meta.assetType === 'MUTUAL_FUND' ? 'Current NAV' : 'Current price'}
              error={err.manualPrice?.message}
              {...(hasManualValue ? { hint: 'Not used while a manual value is set' } : {})}
            >
              <Input
                prefix={currencyPrefix(quote)}
                inputMode="decimal"
                disabled={hasManualValue}
                {...register('manualPrice')}
              />
            </Field>
          ) : null}
          <Field label="Fees (optional)" error={err.fees?.message}>
            <Input prefix={currencyPrefix(quote)} inputMode="decimal" {...register('fees')} />
          </Field>
          {priceMode === 'MANUAL' ? (
            <div className="flex flex-col gap-2 lg:col-span-2">
              <Field
                label="Manual current value (optional)"
                error={err.manualCurrentValue?.message}
              >
                <Input
                  prefix={currencyPrefix(quote)}
                  inputMode="decimal"
                  {...register('manualCurrentValue')}
                />
              </Field>
              <p className="text-sm text-label-secondary" data-testid="value-rule">
                Manual value overrides price × quantity.
              </p>
            </div>
          ) : null}

          {meta.quoteCurrencyEditable ? (
            <Field label="Currency">
              <Select {...register('quoteCurrency')}>
                {(currencies.data ?? []).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
                {(currencies.data ?? []).length === 0 ? (
                  <option value={space.baseCurrency}>{space.baseCurrency}</option>
                ) : null}
              </Select>
            </Field>
          ) : (
            <p className="self-end pb-3 text-sm text-label-secondary">Priced in {quote}</p>
          )}
          <Field label="Purchase date (optional)" error={err.purchaseDate?.message}>
            <Input type="date" {...register('purchaseDate')} />
          </Field>

          {quote !== space.baseCurrency ? (
            <div className="flex flex-col gap-2" data-testid="fx-block">
              <div className="flex min-h-12 items-center justify-between gap-3 text-sm font-medium text-label-secondary">
                <span aria-hidden>Use my own exchange rate</span>
                <Switch
                  aria-label="Use my own exchange rate"
                  checked={ownRate}
                  onCheckedChange={(on) => {
                    setOwnRate(on)
                    if (!on) setValue('manualFxRate', '')
                  }}
                />
              </div>
              {ownRate ? (
                <Field
                  label={`Exchange rate (1 ${quote} = ? ${space.baseCurrency})`}
                  error={err.manualFxRate?.message}
                >
                  <Input inputMode="decimal" {...register('manualFxRate')} />
                </Field>
              ) : providerRate ? (
                <p className="text-sm text-label-secondary" data-testid="fx-help">
                  Today's rate: {providerRate} · FX service
                </p>
              ) : null}
            </div>
          ) : null}
          <Field
            label="Expected yearly change (optional)"
            hint="Only used for projections. Leave empty for none."
            error={err.estimatedAnnualChangePct?.message}
          >
            <Input inputMode="decimal" {...register('estimatedAnnualChangePct')} />
          </Field>

          <WrapperField
            assetType={meta.assetType as string}
            value={watched.wrapper ?? ''}
            onChange={(w) => setValue('wrapper', w, { shouldValidate: true })}
            error={err.wrapper?.message}
          />

          {(meta.detailFields ?? []).filter((f) => !lots || f.name !== 'lots').map(detailInput)}
        </div>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium text-label-secondary">
            Pay from a wallet (optional)
          </legend>
          <div className={PAIR}>
            <Field label="Wallet" error={err.fundingWalletId?.message}>
              <Select {...register('fundingWalletId')}>
                <option value="">Don't take it from a wallet</option>
                {(wallets.data?.items ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.icon} {w.name} · {w.currency}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Amount from the wallet (optional)"
              hint="Leave empty to use quantity × price + fees"
              error={err.fundingAmount?.message}
            >
              <Input inputMode="decimal" {...register('fundingAmount')} />
            </Field>
          </div>
        </fieldset>

        {/* Sticky so Add is reachable without scrolling. On phones it sits above the floating tab bar. */}
        <div
          data-testid="submit-bar"
          className="sticky bottom-24 z-20 -mx-4 border-t border-border bg-bg/90 px-4 py-3 backdrop-blur-[20px] md:bottom-0 md:-mx-8 md:px-8 lg:mx-0 lg:rounded-lg lg:border lg:px-4"
        >
          <Button
            type="submit"
            block
            disabled={create.isPending || !nameFilled}
            aria-describedby={nameFilled ? undefined : 'add-investment-reason'}
          >
            {create.isPending ? 'Adding…' : 'Add investment'}
          </Button>
          {nameFilled ? null : (
            <DisabledReason id="add-investment-reason">
              Enter a name to add this investment
            </DisabledReason>
          )}
        </div>
      </form>

      <SummaryRail meta={meta} {...watched} />
    </div>
  )
}
