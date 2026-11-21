import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSpace } from '@/app/providers/SpaceProvider'
import type { CategoryType } from '@/shared/api/categories'
import { useWallets } from '@/shared/api/wallets'
import { Decimal, parseInput } from '@/shared/money'
import { isValidDay } from '@/shared/period'
import { Amount } from '@/shared/ui/Amount'
import { CategoryPicker } from '@/shared/ui/CategoryPicker'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { MoneyInput } from '@/shared/ui/MoneyInput'
import { Select } from '@/shared/ui/Select'
import { localDate } from './datetime'

export const txnSchema = z.object({
  amount: z
    .string()
    .refine((v) => v !== '' && new Decimal(v).greaterThan(0), 'Enter an amount greater than zero'),
  walletId: z.string().min(1, 'Choose a wallet'),
  categoryId: z.string().nullable(),
  date: z.string().refine(isValidDay, 'Choose a valid date'),
  note: z.string().max(1000, 'Use at most 1000 characters'),
})
export type TxnValues = z.infer<typeof txnSchema>

interface TransactionFormProps {
  type: CategoryType
  initial?: Partial<TxnValues>
  /** ADJUSTMENT and OPENING_BALANCE rows only allow their note to change. */
  noteOnly?: boolean
  formId: string
  onSubmit: (values: TxnValues, normalisedAmount: string) => void
}

/** Amount first (calculator keypad), then wallet, category, date and note. Used to add and to edit. */
export function TransactionForm({
  type,
  initial,
  noteOnly,
  formId,
  onSubmit,
}: TransactionFormProps) {
  const { space } = useSpace()
  const wallets = useWallets(space.id)
  const list = wallets.data?.items ?? []
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<TxnValues>({
    resolver: zodResolver(txnSchema),
    defaultValues: {
      amount: initial?.amount ?? '',
      walletId: initial?.walletId ?? '',
      categoryId: initial?.categoryId ?? null,
      date: initial?.date ?? localDate(new Date()),
      note: initial?.note ?? '',
    },
  })

  const chosen = watch('walletId')
  const walletId = chosen || list[0]?.id || ''
  // Preselect the first wallet once the list arrives.
  useEffect(() => {
    if (!chosen && list[0]?.id) setValue('walletId', list[0].id)
  }, [chosen, list, setValue])
  const currency = useMemo(
    () => list.find((w) => w.id === walletId)?.currency ?? space.baseCurrency,
    [list, walletId, space.baseCurrency],
  )

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-5"
      onSubmit={handleSubmit((v) => {
        const normalised = parseInput(v.amount, currency) ?? v.amount
        onSubmit({ ...v, walletId: v.walletId || walletId }, normalised)
      })}
    >
      {noteOnly ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-label-secondary">Amount</p>
          <Amount
            value={initial?.amount ?? '0'}
            currency={currency}
            className="text-xl font-medium"
          />
        </div>
      ) : (
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <Field label={`Amount (${currency})`} error={errors.amount?.message}>
              <MoneyInput value={field.value} onChange={field.onChange} currency={currency} />
            </Field>
          )}
        />
      )}
      <Controller
        control={control}
        name="walletId"
        render={({ field }) => (
          <Field label="Wallet" error={errors.walletId?.message}>
            <Select
              disabled={noteOnly}
              value={field.value || walletId}
              onChange={(e) => field.onChange(e.target.value)}
            >
              {list.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon} {w.name} · {w.currency}
                </option>
              ))}
            </Select>
          </Field>
        )}
      />
      {noteOnly ? null : (
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <CategoryPicker
              spaceId={space.id}
              type={type}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      )}
      <Field label="Date" error={errors.date?.message}>
        <Input type="date" disabled={noteOnly} {...register('date')} />
      </Field>
      <Field label="Note (optional)" error={errors.note?.message}>
        <Input maxLength={1000} {...register('note')} />
      </Field>
    </form>
  )
}
