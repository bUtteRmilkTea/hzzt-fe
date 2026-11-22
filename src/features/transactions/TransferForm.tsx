import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSpace } from '@/app/providers/SpaceProvider'
import { useWallets } from '@/shared/api/wallets'
import { Decimal, format, parseInput } from '@/shared/money'
import { isValidDay } from '@/shared/period'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { MoneyInput } from '@/shared/ui/MoneyInput'
import { Select } from '@/shared/ui/Select'
import { localDate } from './datetime'

const positive = (v: string) => v !== '' && new Decimal(v).greaterThan(0)

export const transferSchema = z
  .object({
    fromWalletId: z.string().min(1, 'Choose a source wallet'),
    toWalletId: z.string().min(1, 'Choose a destination wallet'),
    amount: z.string().refine(positive, 'Enter an amount greater than zero'),
    toAmount: z.string(),
    date: z.string().refine(isValidDay, 'Choose a valid date'),
    note: z.string().max(1000),
  })
  .refine((v) => !v.fromWalletId || !v.toWalletId || v.fromWalletId !== v.toWalletId, {
    path: ['toWalletId'],
    message: 'Choose two different wallets',
  })
export type TransferValues = z.infer<typeof transferSchema>

/** `1 USD = 16,250 IDR`, from the two amounts. Display only: the server stores the real rate. */
export function impliedRate(amount: string, toAmount: string): Decimal | null {
  if (!positive(amount) || !positive(toAmount)) return null
  return new Decimal(toAmount).div(new Decimal(amount))
}

interface TransferFormProps {
  formId: string
  initial?: Partial<TransferValues>
  onSubmit: (values: TransferValues, amounts: { amount: string; toAmount: string | null }) => void
}

/** From and to wallets, amount, and a received amount that appears only when the currencies differ. */
export function TransferForm({ formId, initial, onSubmit }: TransferFormProps) {
  const { space } = useSpace()
  const wallets = useWallets(space.id)
  const list = wallets.data?.items ?? []
  const {
    control,
    register,
    watch,
    setValue,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromWalletId: initial?.fromWalletId ?? '',
      toWalletId: initial?.toWalletId ?? '',
      amount: initial?.amount ?? '',
      toAmount: initial?.toAmount ?? '',
      date: initial?.date ?? localDate(new Date()),
      note: initial?.note ?? '',
    },
  })

  const fromId = watch('fromWalletId')
  const toId = watch('toWalletId')
  const amount = watch('amount')
  const toAmount = watch('toAmount')
  useEffect(() => {
    if (!fromId && list[0]?.id) setValue('fromWalletId', list[0].id)
    if (!toId && list[1]?.id) setValue('toWalletId', list[1].id)
  }, [fromId, toId, list, setValue])

  const from = list.find((w) => w.id === fromId)
  const to = list.find((w) => w.id === toId)
  const crossCurrency = Boolean(from?.currency && to?.currency && from.currency !== to.currency)
  const rate = crossCurrency ? impliedRate(amount, toAmount) : null
  const rateText = useMemo(
    () =>
      rate && from?.currency && to?.currency
        ? `1 ${from.currency} = ${format(rate, to.currency, { withoutSymbol: true })} ${to.currency}`
        : null,
    [rate, from?.currency, to?.currency],
  )

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={handleSubmit((v) => {
        const normalised = parseInput(v.amount, from?.currency ?? space.baseCurrency) ?? v.amount
        if (crossCurrency) {
          // A cross-currency transfer cannot be sent without the amount received.
          if (!positive(v.toAmount)) {
            setError('toAmount', { type: 'required', message: 'Enter the amount received' })
            return
          }
          onSubmit(v, {
            amount: normalised,
            toAmount: parseInput(v.toAmount, to?.currency ?? '') ?? v.toAmount,
          })
          return
        }
        onSubmit(v, { amount: normalised, toAmount: null })
      })}
    >
      <Controller
        control={control}
        name="fromWalletId"
        render={({ field }) => (
          <Field label="From" error={errors.fromWalletId?.message}>
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {list.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon} {w.name} · {w.currency}
                </option>
              ))}
            </Select>
          </Field>
        )}
      />
      <Controller
        control={control}
        name="toWalletId"
        render={({ field }) => (
          <Field label="To" error={errors.toWalletId?.message}>
            <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
              {list.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon} {w.name} · {w.currency}
                </option>
              ))}
            </Select>
          </Field>
        )}
      />
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <Field
            label={`Amount (${from?.currency ?? space.baseCurrency})`}
            error={errors.amount?.message}
          >
            <MoneyInput
              value={field.value}
              onChange={field.onChange}
              currency={from?.currency ?? space.baseCurrency}
            />
          </Field>
        )}
      />
      {crossCurrency ? (
        <Controller
          control={control}
          name="toAmount"
          render={({ field }) => (
            <Field
              label={`Amount received (${to?.currency})`}
              hint={
                rateText ?? 'Different currencies: enter what arrives in the destination wallet.'
              }
              error={errors.toAmount?.message}
            >
              <MoneyInput
                value={field.value}
                onChange={field.onChange}
                currency={to?.currency ?? ''}
                mode="numeric"
              />
            </Field>
          )}
        />
      ) : null}
      <Field label="Date" error={errors.date?.message}>
        <Input type="date" {...register('date')} />
      </Field>
      <Field label="Note (optional)" error={errors.note?.message}>
        <Input maxLength={1000} {...register('note')} />
      </Field>
    </form>
  )
}
