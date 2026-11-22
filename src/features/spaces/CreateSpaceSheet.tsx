import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSpace } from '@/app/providers/SpaceProvider'
import { applyServerError } from '@/features/auth/useServerErrors'
import { api } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { ColorPicker } from '@/shared/ui/ColorPicker'
import { EmojiPicker } from '@/shared/ui/EmojiPicker'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { DEFAULT_SPACE_COLOR } from '@/shared/ui/palette'
import { Select } from '@/shared/ui/Select'
import { SheetShell } from '@/shared/ui/SheetShell'
import { useCurrencies, useInvalidateSpaces } from './hooks'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(40, 'Use at most 40 characters'),
  avatarEmoji: z.string().min(1),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #4480EE'),
  baseCurrency: z.string().min(1, 'Choose a currency'),
})
type Values = z.infer<typeof schema>

export function CreateSpaceSheet({ onClose }: { onClose: () => void }) {
  const { switchSpace, space } = useSpace()
  const invalidateSpaces = useInvalidateSpaces()
  const { data: currencies = [] } = useCurrencies()
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
      avatarEmoji: '🏠',
      avatarColor: DEFAULT_SPACE_COLOR,
      baseCurrency: space.baseCurrency,
    },
  })

  const create = useMutation({
    mutationFn: async (body: Values) => (await api.POST('/spaces', { body })).data,
    meta: { silent: true },
    onSuccess: async (created) => {
      await invalidateSpaces()
      onClose()
      if (created?.id) await switchSpace(created.id)
    },
    onError: (err) =>
      setFormError(
        applyServerError(err, setError, ['name', 'avatarEmoji', 'avatarColor', 'baseCurrency']),
      ),
  })

  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && onClose()}
      title="Create space"
      description="A space holds its own wallets, transactions and members."
      footer={
        <Button
          block
          disabled={create.isPending}
          onClick={handleSubmit((v) => {
            setFormError(null)
            create.mutate(v)
          })}
        >
          {create.isPending ? 'Creating…' : 'Create space'}
        </Button>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        {formError ? (
          <p role="alert" className="text-sm text-negative">
            {formError}
          </p>
        ) : null}
        <Field label="Name" error={errors.name?.message}>
          <Input maxLength={40} {...register('name')} />
        </Field>
        <Field label="Base currency" error={errors.baseCurrency?.message}>
          <Select {...register('baseCurrency')}>
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
          name="avatarEmoji"
          render={({ field }) => <EmojiPicker value={field.value} onChange={field.onChange} />}
        />
        <Controller
          control={control}
          name="avatarColor"
          render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
        />
      </form>
    </SheetShell>
  )
}
