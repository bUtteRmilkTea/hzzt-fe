import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSession } from '@/app/providers/SessionProvider'
import { api, refreshSession } from '@/shared/api/client'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useToast } from '@/shared/ui/Toast'
import { applyServerError } from './useServerErrors'

/** Every IANA timezone the browser knows. */
export function supportedTimezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf(
      'timeZone',
    )
  } catch {
    return ['UTC']
  }
}

const profileSchema = (zones: readonly string[]) =>
  z.object({
    name: z.string().trim().min(1, 'Enter your name').max(60, 'Use at most 60 characters'),
    timezone: z
      .string()
      .refine((v) => zones.includes(v) || v === 'UTC', 'Choose a timezone from the list'),
  })

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(128, 'Use at most 128 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
type PasswordValues = z.infer<typeof passwordSchema>

export function ProfileScreen() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <PageHeader title="Profile" backToSettings />
      <ProfileForm />
      <ChangePasswordForm />
      <SignOut />
    </div>
  )
}

function ProfileForm() {
  const { user, applyUser } = useSession()
  const toast = useToast()
  const zones = supportedTimezones()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema(zones)),
    defaultValues: { name: user?.name ?? '', timezone: user?.timezone ?? 'UTC' },
  })

  const save = useMutation({
    mutationFn: async (body: { name: string; timezone: string }) =>
      (await api.PATCH('/me', { body })).data,
    meta: { silent: true },
    onSuccess: (dto, vars) => {
      if (dto) applyUser(dto)
      reset(vars)
      toast.show('Profile saved', 'success')
    },
    onError: (err) => setFormError(applyServerError(err, setError, ['name', 'timezone'])),
  })

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((v) => {
        setFormError(null)
        save.mutate(v)
      })}
    >
      {formError ? (
        <p role="alert" className="text-sm text-negative">
          {formError}
        </p>
      ) : null}
      <Field label="Email" hint="Your email can't be changed here">
        <Input value={user?.email ?? ''} readOnly />
      </Field>
      <Field label="Name" error={errors.name?.message}>
        <Input autoComplete="name" {...register('name')} />
      </Field>
      <Field label="Timezone" error={errors.timezone?.message}>
        <Input list="timezones" autoComplete="off" {...register('timezone')} />
      </Field>
      <datalist id="timezones">
        {zones.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
      <Button type="submit" disabled={!isDirty || save.isPending}>
        {save.isPending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  )
}

function ChangePasswordForm() {
  const { logout } = useSession()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })

  const change = useMutation({
    mutationFn: async (v: PasswordValues) =>
      api.POST('/auth/change-password', {
        body: { currentPassword: v.currentPassword, newPassword: v.newPassword },
      }),
    meta: { silent: true },
    onSuccess: async () => {
      reset()
      toast.show('Password changed. Other devices were signed out.', 'success')
      // The server revokes the other sessions. Confirm this one survived, else sign in again.
      if (!(await refreshSession())) await logout()
    },
    onError: (err) => {
      const e = toAppError(err)
      if (e.code === 'INVALID_CURRENT_PASSWORD') {
        setError('currentPassword', {
          type: 'server',
          message: 'Your current password is incorrect.',
        })
        return
      }
      setFormError(applyServerError(err, setError, ['currentPassword', 'newPassword']))
    },
  })

  return (
    <form
      noValidate
      aria-labelledby="password-heading"
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((v) => {
        setFormError(null)
        change.mutate(v)
      })}
    >
      <h2 id="password-heading" className="text-lg font-semibold">
        Change password
      </h2>
      {formError ? (
        <p role="alert" className="text-sm text-negative">
          {formError}
        </p>
      ) : null}
      <Field label="Current password" error={errors.currentPassword?.message}>
        <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
      </Field>
      <Field label="New password" hint="At least 8 characters" error={errors.newPassword?.message}>
        <Input type="password" autoComplete="new-password" {...register('newPassword')} />
      </Field>
      <Field label="Confirm new password" error={errors.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
      </Field>
      <Button type="submit" disabled={change.isPending}>
        {change.isPending ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  )
}

function SignOut() {
  const { logout } = useSession()
  return (
    <Button variant="secondary" block onClick={() => void logout()}>
      Sign out
    </Button>
  )
}
