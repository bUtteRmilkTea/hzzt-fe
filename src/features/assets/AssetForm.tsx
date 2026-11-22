import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useState } from 'react'
import { type Control, Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useSpace } from '@/app/providers/SpaceProvider'
import { applyServerError } from '@/features/auth/useServerErrors'
import { useCurrencies } from '@/features/spaces/hooks'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { Decimal, parseInput } from '@/shared/money'
import { isValidDay } from '@/shared/period'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmojiPicker } from '@/shared/ui/EmojiPicker'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { MoneyInput } from '@/shared/ui/MoneyInput'
import { Select } from '@/shared/ui/Select'
import { useToast } from '@/shared/ui/Toast'
import { type AssetDTO, useCreateAsset, useUpdateAsset } from './hooks'
import { type AssetKind, kindMeta } from './kinds'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(120, 'Use at most 120 characters'),
  icon: z.string().min(1),
  currency: z.string().min(1),
  currentValue: z
    .string()
    .refine((v) => v !== '' && !new Decimal(v).isNegative(), 'Enter an amount of zero or more'),
  counterpartyName: z.string().max(120),
  dueDate: z.string().refine((v) => v === '' || isValidDay(v), 'Enter a valid date'),
  estimatedAnnualChangePct: z
    .string()
    .refine((v) => v === '' || /^-?\d+(\.\d+)?$/.test(v), 'Enter a number'),
  note: z.string().max(1000),
})
type Values = z.infer<typeof schema>

const plainMoney = (v: string) => (/^\d+(\.\d+)?$/.test(v) ? v : '0')

/** A live card of the item as it is being typed. Hidden below 1024px, where the form is the whole screen. */
function AssetPreview({ kind, control }: { kind: AssetKind; control: Control<Values> }) {
  const v = useWatch({ control })
  const meta = kindMeta(kind)
  const valid = (d: string | undefined) => (d && isValidDay(d) ? d : null)
  const due = valid(v.dueDate)
  return (
    <Card data-testid="asset-preview" className="hidden flex-col gap-1 lg:flex">
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-3xl">
          {v.icon || meta.defaultIcon}
        </span>
        <p className="min-w-0 truncate text-lg font-medium">{v.name || `New ${meta.noun}`}</p>
      </div>
      <p className="mt-2 text-sm text-label-secondary">
        {kind === 'LIABILITY' ? 'Outstanding' : kind === 'RECEIVABLE' ? 'Owed to you' : 'Value'}
      </p>
      <p className="text-3xl font-medium">
        <Amount value={plainMoney(v.currentValue ?? '')} currency={v.currency ?? ''} />
      </p>
      {v.counterpartyName && kind !== 'FIXED_ASSET' ? (
        <p className="text-sm text-label-secondary">
          {kind === 'LIABILITY' ? 'Owed to' : 'Owed by'} {v.counterpartyName}
        </p>
      ) : null}
      {due && kind !== 'FIXED_ASSET' ? (
        <p className="text-sm text-label-secondary">
          Due {format(new Date(`${due}T12:00:00`), 'd MMM yyyy')}
        </p>
      ) : null}
      {v.estimatedAnnualChangePct && kind === 'FIXED_ASSET' ? (
        <p className="text-sm text-label-secondary">
          Estimated change {v.estimatedAnnualChangePct}% a year
        </p>
      ) : null}
    </Card>
  )
}

/** Create (`asset` absent) or edit a fixed asset, a receivable or a liability. */
export function AssetForm({ kind, asset }: { kind: AssetKind; asset?: AssetDTO }) {
  const { space } = useSpace()
  const navigate = useNavigate()
  const toast = useToast()
  const meta = kindMeta(kind)
  const currencies = useCurrencies()
  const create = useCreateAsset(space.id)
  const update = useUpdateAsset(space.id, asset?.id ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [currencyLocked, setCurrencyLocked] = useState(false)
  const editing = Boolean(asset)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: asset?.name ?? '',
      icon: asset?.icon ?? meta.defaultIcon,
      currency: asset?.currency ?? space.baseCurrency,
      currentValue: asset?.currentValue ?? '',
      counterpartyName: asset?.counterpartyName ?? '',
      dueDate: asset?.dueDate ?? '',
      estimatedAnnualChangePct: asset?.estimatedAnnualChangePct ?? '',
      note: asset?.note ?? '',
    },
  })

  const onError = (e: unknown) => {
    if (toAppError(e).code === 'MANUAL_ASSET_CURRENCY_LOCKED') {
      setCurrencyLocked(true)
      setFormError(errorMessage(e))
      return
    }
    setFormError(
      applyServerError(e, setError, [
        'name',
        'icon',
        'currency',
        'currentValue',
        'counterpartyName',
        'dueDate',
        'estimatedAnnualChangePct',
        'note',
      ]),
    )
  }

  const submit = handleSubmit((v) => {
    setFormError(null)
    const value = parseInput(v.currentValue, v.currency) ?? v.currentValue
    const fixed = kind === 'FIXED_ASSET'
    if (!asset) {
      create.mutate(
        {
          kind,
          name: v.name,
          icon: v.icon,
          currency: v.currency,
          currentValue: value,
          ...(v.counterpartyName && !fixed ? { counterpartyName: v.counterpartyName } : {}),
          ...(v.dueDate && !fixed ? { dueDate: v.dueDate } : {}),
          ...(v.estimatedAnnualChangePct && fixed
            ? { estimatedAnnualChangePct: v.estimatedAnnualChangePct }
            : {}),
          ...(v.note ? { note: v.note } : {}),
        },
        {
          onSuccess: (a) => {
            toast.show('Added', 'success')
            void navigate({
              to: '/s/$spaceId/assets/$id',
              params: { spaceId: space.id, id: a?.id as string },
            })
          },
          onError,
        },
      )
      return
    }
    update.mutate(
      {
        name: v.name,
        icon: v.icon,
        currentValue: value,
        ...(currencyLocked ? {} : { currency: v.currency }),
        // null clears these (backend contract)
        counterpartyName: fixed ? undefined : v.counterpartyName || null,
        dueDate: fixed ? undefined : v.dueDate || null,
        estimatedAnnualChangePct: fixed ? v.estimatedAnnualChangePct || null : undefined,
        note: v.note || null,
      },
      {
        onSuccess: () => {
          toast.show('Saved', 'success')
          void navigate({
            to: '/s/$spaceId/assets/$id',
            params: { spaceId: space.id, id: asset.id as string },
          })
        },
        onError,
      },
    )
  })

  return (
    <form
      noValidate
      onSubmit={submit}
      data-testid="asset-form-layout"
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10"
    >
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        {formError ? (
          <p role="alert" className="text-sm text-negative lg:col-span-2">
            {formError}
          </p>
        ) : null}
        <Field label="Name" error={errors.name?.message}>
          <Input maxLength={120} {...register('name')} />
        </Field>
        <div className="lg:col-span-2">
          <Controller
            control={control}
            name="icon"
            render={({ field }) => (
              <EmojiPicker label="Icon" value={field.value} onChange={field.onChange} />
            )}
          />
        </div>
        <Field
          label="Currency"
          hint={currencyLocked ? "Currency can't change once there are settlements." : undefined}
        >
          <Select disabled={currencyLocked} {...register('currency')}>
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
        <Controller
          control={control}
          name="currentValue"
          render={({ field }) => (
            <Field
              label={
                kind === 'LIABILITY'
                  ? 'Amount outstanding'
                  : kind === 'RECEIVABLE'
                    ? 'Amount owed to you'
                    : 'Current value'
              }
              error={errors.currentValue?.message}
            >
              <MoneyInput
                value={field.value}
                onChange={field.onChange}
                currency={space.baseCurrency}
              />
            </Field>
          )}
        />
        {kind !== 'FIXED_ASSET' ? (
          <>
            <Field label={kind === 'LIABILITY' ? 'Owed to (optional)' : 'Who owes you (optional)'}>
              <Input maxLength={120} {...register('counterpartyName')} />
            </Field>
            <Field label="Due date (optional)" error={errors.dueDate?.message}>
              <Input type="date" {...register('dueDate')} />
            </Field>
          </>
        ) : (
          <Field
            label="Estimated annual change % (optional)"
            error={errors.estimatedAnnualChangePct?.message}
          >
            <Input inputMode="decimal" {...register('estimatedAnnualChangePct')} />
          </Field>
        )}
        <div className="lg:col-span-2">
          <Field label="Note (optional)" error={errors.note?.message}>
            <Input maxLength={1000} {...register('note')} />
          </Field>
        </div>
      </div>
      <aside
        aria-label="Preview"
        className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-4"
        data-testid="asset-aside"
      >
        <AssetPreview kind={kind} control={control} />
        <Button type="submit" block disabled={create.isPending || update.isPending}>
          {create.isPending || update.isPending
            ? 'Saving…'
            : editing
              ? 'Save changes'
              : meta.addLabel}
        </Button>
      </aside>
    </form>
  )
}
