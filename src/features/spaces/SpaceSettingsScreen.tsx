import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { type ActiveSpace, type TrackingMode, useSpace } from '@/app/providers/SpaceProvider'
import { applyServerError } from '@/features/auth/useServerErrors'
import { api } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { ColorPicker } from '@/shared/ui/ColorPicker'
import { EmojiPicker } from '@/shared/ui/EmojiPicker'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { PageHeader } from '@/shared/ui/PageHeader'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { useToast } from '@/shared/ui/Toast'
import { useCurrencies, useInvalidateSpaces } from './hooks'
import { InvitationSection } from './InvitationSection'
import { MembersSection } from './MembersSection'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(40, 'Use at most 40 characters'),
  avatarEmoji: z.string().min(1),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #4480EE'),
  baseCurrency: z.string().min(1),
  autoFxConversion: z.boolean(),
  trackingMode: z.enum(['FULL_NET_WORTH', 'CASH_ONLY']),
})
type Values = z.infer<typeof schema>

function defaults(space: ActiveSpace): Values {
  return {
    name: space.name,
    avatarEmoji: space.avatarEmoji,
    avatarColor: space.avatarColor,
    baseCurrency: space.baseCurrency,
    autoFxConversion: space.autoFxConversion,
    trackingMode: space.trackingMode,
  }
}

export function SpaceSettingsScreen() {
  const { space, isOwner } = useSpace()
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <PageHeader title="Space" backToSettings />
      {/* Remount on a space switch so the form never shows another space's values. */}
      <SpaceForm key={space.id} space={space} isOwner={isOwner} />
      <MembersSection />
      {isOwner ? <InvitationSection /> : null}
    </div>
  )
}

function SpaceForm({ space, isOwner }: { space: ActiveSpace; isOwner: boolean }) {
  const toast = useToast()
  const invalidateSpaces = useInvalidateSpaces()
  const { data: currencies = [] } = useCurrencies()
  const [formError, setFormError] = useState<string | null>(null)
  const readOnly = !isOwner
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(space) })

  const save = useMutation({
    mutationFn: async (body: Values) =>
      (await api.PATCH('/spaces/{spaceId}', { params: { path: { spaceId: space.id } }, body }))
        .data,
    meta: { silent: true },
    onSuccess: async (updated, vars) => {
      await invalidateSpaces()
      reset(vars)
      toast.show('Space saved', 'success')
      return updated
    },
    onError: (err) => setFormError(applyServerError(err, setError, Object.keys(defaults(space)))),
  })

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => {
        setFormError(null)
        save.mutate(v)
      })}
      className="flex flex-col gap-5"
    >
      {readOnly ? (
        <p className="rounded-md border border-border bg-surface-1 px-4 py-3 text-sm text-label-secondary">
          Only the space owner can change these settings.
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="text-sm text-negative">
          {formError}
        </p>
      ) : null}

      <Field label="Name" error={errors.name?.message}>
        <Input maxLength={40} readOnly={readOnly} {...register('name')} />
      </Field>

      <Field label="Base currency" hint="Totals are shown in this currency">
        <Select disabled={readOnly} {...register('baseCurrency')}>
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

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Automatic currency conversion</p>
          <p className="text-sm text-label-secondary">When off, you set exchange rates yourself</p>
        </div>
        <Controller
          control={control}
          name="autoFxConversion"
          render={({ field }) => (
            <Switch
              aria-label="Automatic currency conversion"
              disabled={readOnly}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-label-secondary">Tracking mode</p>
        <Controller
          control={control}
          name="trackingMode"
          render={({ field }) => (
            <fieldset disabled={readOnly} className="contents">
              <SegmentedControl
                aria-label="Tracking mode"
                value={field.value}
                onValueChange={(v: TrackingMode) => field.onChange(v)}
                options={[
                  { value: 'FULL_NET_WORTH', label: 'Full net worth' },
                  { value: 'CASH_ONLY', label: 'Cash only' },
                ]}
              />
            </fieldset>
          )}
        />
      </div>

      <fieldset disabled={readOnly} className="flex flex-col gap-5 disabled:opacity-60">
        <Controller
          control={control}
          name="avatarEmoji"
          render={({ field }) => (
            <EmojiPicker label="Avatar emoji" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="avatarColor"
          render={({ field }) => (
            <ColorPicker label="Avatar colour" value={field.value} onChange={field.onChange} />
          )}
        />
      </fieldset>

      {isOwner ? (
        <Button type="submit" block disabled={!isDirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      ) : null}
    </form>
  )
}
