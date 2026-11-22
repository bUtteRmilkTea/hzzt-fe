import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSpace } from '@/app/providers/SpaceProvider'
import { applyServerError } from '@/features/auth/useServerErrors'
import { useCurrencies } from '@/features/spaces/hooks'
import { api } from '@/shared/api/client'
import { Decimal, parseInput } from '@/shared/money'
import { Button } from '@/shared/ui/Button'
import { ColorPicker } from '@/shared/ui/ColorPicker'
import { EmojiPicker } from '@/shared/ui/EmojiPicker'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { MoneyInput } from '@/shared/ui/MoneyInput'
import { DEFAULT_SPACE_COLOR } from '@/shared/ui/palette'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { Select } from '@/shared/ui/Select'
import { SheetShell } from '@/shared/ui/SheetShell'
import { toRequestCardStyle } from './cardStyleSchema'
import { useInvalidateMoney } from './hooks'

export const WALLET_TYPES = [
  { value: 'BANK', label: 'Bank' },
  { value: 'E_WALLET', label: 'E-wallet' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
] as const

const schema = z.object({
  type: z.enum(['BANK', 'E_WALLET', 'CASH', 'OTHER']),
  name: z.string().trim().min(1, 'Enter a name').max(120, 'Use at most 120 characters'),
  icon: z.string().min(1, 'Choose an icon'),
  currency: z.string().min(1, 'Choose a currency'),
  initialBalance: z
    .string()
    .refine(
      (v) => v === '' || (/^-?\d+(\.\d+)?$/.test(v) && !new Decimal(v).isNegative()),
      'Enter zero or a positive amount',
    ),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})
type Values = z.infer<typeof schema>

export function CreateWalletSheet({ onClose }: { onClose: () => void }) {
  const { space } = useSpace()
  const navigate = useNavigate()
  const invalidateMoney = useInvalidateMoney(space.id)
  const { data: currencies = [] } = useCurrencies()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'BANK',
      name: '',
      icon: '🏦',
      currency: space.baseCurrency,
      initialBalance: '',
      color: DEFAULT_SPACE_COLOR,
    },
  })

  const create = useMutation({
    mutationFn: async (v: Values) => {
      const initial = v.initialBalance ? parseInput(v.initialBalance, v.currency) : null
      const hasInitial = initial !== null && !new Decimal(initial).isZero()
      return (
        await api.POST('/spaces/{spaceId}/wallets', {
          params: { path: { spaceId: space.id } },
          body: {
            name: v.name,
            icon: v.icon,
            type: v.type,
            currency: v.currency,
            ...(hasInitial ? { initialBalance: initial } : {}),
            cardStyle: toRequestCardStyle({ mode: 'SOLID', color: v.color }),
          },
        })
      ).data
    },
    meta: { silent: true },
    onSuccess: async (wallet) => {
      await invalidateMoney()
      onClose()
      if (wallet?.id)
        await navigate({
          to: '/s/$spaceId/wallets/$id',
          params: { spaceId: space.id, id: wallet.id },
        })
    },
    onError: (err) =>
      setFormError(
        applyServerError(err, setError, ['name', 'icon', 'type', 'currency', 'initialBalance']),
      ),
  })

  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add wallet"
      footer={
        <Button
          block
          disabled={create.isPending}
          onClick={handleSubmit((v) => {
            setFormError(null)
            create.mutate(v)
          })}
        >
          {create.isPending ? 'Adding…' : 'Add wallet'}
        </Button>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        {formError ? (
          <p role="alert" className="text-sm text-negative">
            {formError}
          </p>
        ) : null}
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <SegmentedControl
              aria-label="Wallet type"
              value={field.value}
              onValueChange={field.onChange}
              options={WALLET_TYPES}
            />
          )}
        />
        <Field label="Name" error={errors.name?.message}>
          <Input maxLength={120} {...register('name')} />
        </Field>
        <Field label="Currency" error={errors.currency?.message}>
          <Select {...register('currency')}>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
            {currencies.length === 0 ? (
              <option value={space.baseCurrency}>{space.baseCurrency}</option>
            ) : null}
          </Select>
        </Field>
        <Controller
          control={control}
          name="initialBalance"
          render={({ field }) => (
            <Field label="Initial balance (optional)" error={errors.initialBalance?.message}>
              <MoneyInput
                value={field.value}
                onChange={field.onChange}
                currency={watch('currency')}
              />
            </Field>
          )}
        />
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
            <ColorPicker label="Card colour" value={field.value} onChange={field.onChange} />
          )}
        />
      </form>
    </SheetShell>
  )
}
