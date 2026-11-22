import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useSpace } from '@/app/providers/SpaceProvider'
import { applyServerError } from '@/features/auth/useServerErrors'
import { useCurrencies } from '@/features/spaces/hooks'
import { toAppError } from '@/shared/api/errors'
import { useWallets } from '@/shared/api/wallets'
import { Decimal, parseInput } from '@/shared/money'
import { isValidDay } from '@/shared/period'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { ColorPicker } from '@/shared/ui/ColorPicker'
import { EmojiPicker } from '@/shared/ui/EmojiPicker'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { MoneyInput } from '@/shared/ui/MoneyInput'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PALETTE } from '@/shared/ui/palette'
import { Select } from '@/shared/ui/Select'
import { useToast } from '@/shared/ui/Toast'
import { useCreateGoal } from './hooks'
import { availableAfter, reserveProblem } from './reserve'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(120, 'Use at most 120 characters'),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  currency: z.string().min(1),
  targetAmount: z
    .string()
    .refine((v) => v !== '' && new Decimal(v).greaterThan(0), 'Enter a target above zero'),
  targetDate: z.string().refine((v) => v === '' || isValidDay(v), 'Enter a valid date'),
  reserveWalletId: z.string(),
  reserveAmount: z.string(),
})
type Values = z.infer<typeof schema>

export function GoalFormScreen() {
  const { space } = useSpace()
  const navigate = useNavigate()
  const toast = useToast()
  const create = useCreateGoal(space.id)
  const wallets = useWallets(space.id)
  const currencies = useCurrencies()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      icon: '🎯',
      color: PALETTE[0],
      currency: space.baseCurrency,
      targetAmount: '',
      targetDate: '',
      reserveWalletId: '',
      reserveAmount: '',
    },
  })
  const walletId = useWatch({ control, name: 'reserveWalletId' })
  const reserveAmount = useWatch({ control, name: 'reserveAmount' })
  const wallet = (wallets.data?.items ?? []).find((w) => w.id === walletId)
  const available = wallet?.available ?? '0'
  const normalised =
    wallet && reserveAmount
      ? (parseInput(reserveAmount, wallet.currency ?? '') ?? reserveAmount)
      : ''
  const problem = wallet && normalised ? reserveProblem(normalised, available, '0') : null

  const submit = handleSubmit((v) => {
    setFormError(null)
    if (v.reserveAmount && !v.reserveWalletId) {
      setError('reserveWalletId', {
        type: 'required',
        message: 'Choose the wallet to reserve from.',
      })
      return
    }
    if (problem) return
    create.mutate(
      {
        name: v.name,
        icon: v.icon,
        color: v.color,
        currency: v.currency,
        targetAmount: parseInput(v.targetAmount, v.currency) ?? v.targetAmount,
        ...(v.targetDate ? { targetDate: v.targetDate } : {}),
        ...(v.reserveWalletId && normalised && new Decimal(normalised).greaterThan(0)
          ? { initialReserve: { walletId: v.reserveWalletId, amount: normalised } }
          : {}),
      },
      {
        onSuccess: (g) => {
          toast.show('Goal added', 'success')
          void navigate({
            to: '/s/$spaceId/goals/$id',
            params: { spaceId: space.id, id: g?.id as string },
          })
        },
        onError: (e) =>
          setFormError(
            toAppError(e).code === 'VALIDATION_FAILED'
              ? (applyServerError(e, setError, ['name', 'targetAmount', 'targetDate']) ?? null)
              : applyServerError(e, setError, []),
          ),
      },
    )
  })

  return (
    <Page width="form" gap={5}>
      <PageHeader title="Add goal" />
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        {formError ? (
          <p role="alert" className="text-sm text-negative">
            {formError}
          </p>
        ) : null}
        <Field label="Name" error={errors.name?.message}>
          <Input maxLength={120} {...register('name')} />
        </Field>
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <EmojiPicker label="Icon" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <ColorPicker label="Colour" value={field.value} onChange={field.onChange} />
          )}
        />
        <Field label="Currency">
          <Select {...register('currency')}>
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
          name="targetAmount"
          render={({ field }) => (
            <Field label="Target amount" error={errors.targetAmount?.message}>
              <MoneyInput
                value={field.value}
                onChange={field.onChange}
                currency={space.baseCurrency}
              />
            </Field>
          )}
        />
        <Field label="Target date (optional)" error={errors.targetDate?.message}>
          <Input type="date" {...register('targetDate')} />
        </Field>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium text-label-secondary">
            Reserve some money now (optional)
          </legend>
          <Field label="From wallet" error={errors.reserveWalletId?.message}>
            <Select {...register('reserveWalletId')}>
              <option value="">Don't reserve anything yet</option>
              {(wallets.data?.items ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon} {w.name} · {w.currency}
                </option>
              ))}
            </Select>
          </Field>
          {wallet ? (
            <>
              <p className="text-sm text-label-secondary" data-testid="available">
                Available:{' '}
                <Amount
                  value={available}
                  currency={wallet.currency ?? ''}
                  className="font-medium text-label"
                />
              </p>
              <Controller
                control={control}
                name="reserveAmount"
                render={({ field }) => (
                  <Field
                    label={`Amount to reserve (${wallet.currency})`}
                    error={problem ?? undefined}
                  >
                    <MoneyInput
                      value={field.value}
                      onChange={field.onChange}
                      currency={wallet.currency ?? ''}
                    />
                  </Field>
                )}
              />
              {normalised && !problem ? (
                <p className="text-sm text-label-secondary" data-testid="available-after">
                  Left available afterwards:{' '}
                  <Amount
                    value={availableAfter(available, '0', normalised)}
                    currency={wallet.currency ?? ''}
                    className="font-medium text-label"
                  />
                </p>
              ) : null}
            </>
          ) : null}
          <p className="text-sm text-label-tertiary">
            Nothing moves. A reservation only earmarks part of a wallet's balance.
          </p>
        </fieldset>

        <Button type="submit" block disabled={create.isPending || Boolean(problem)}>
          {create.isPending ? 'Adding…' : 'Add goal'}
        </Button>
      </form>
    </Page>
  )
}
