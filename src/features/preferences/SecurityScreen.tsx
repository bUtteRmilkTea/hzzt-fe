import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { usePreferences } from '@/app/providers/PreferencesProvider'
import { api } from '@/shared/api/client'
import { errorMessage } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/queryKeys'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { SettingsCol, SettingsGrid } from '@/shared/ui/SettingsGrid'
import { SettingsGroup, SettingsRow } from '@/shared/ui/SettingsRow'
import { SheetShell } from '@/shared/ui/SheetShell'
import { Switch } from '@/shared/ui/Switch'
import { useToast } from '@/shared/ui/Toast'
import { PinPad } from './PinPad'
import { isValidPin } from './pin'

type Mode = 'enable' | 'disable' | 'change' | null

const pinField = z.string().refine(isValidPin, 'Use 4 to 6 digits')

const enableSchema = z
  .object({
    password: z.string().min(1, 'Enter your password'),
    pin: pinField,
    confirm: z.string(),
  })
  .refine((v) => v.pin === v.confirm, { path: ['confirm'], message: 'PINs do not match' })
const disableSchema = z.object({ password: z.string().min(1, 'Enter your password') })
const changeSchema = z.object({ currentPin: pinField, newPin: pinField })

export function SecurityScreen() {
  const { preferences, update } = usePreferences()
  const [mode, setMode] = useState<Mode>(null)
  const close = () => setMode(null)

  return (
    <Page width="wide" gap={6}>
      <PageHeader title="Security" backToSettings />
      <SettingsGrid>
        <SettingsCol>
          <SettingsGroup>
            <SettingsRow label="App lock">
              <Switch
                aria-label="App lock"
                checked={preferences.appLockEnabled}
                onCheckedChange={(on) => setMode(on ? 'enable' : 'disable')}
              />
            </SettingsRow>
            {preferences.appLockEnabled ? (
              <button
                type="button"
                onClick={() => setMode('change')}
                className="flex min-h-14 w-full items-center px-4 text-left hover:bg-surface-3"
              >
                Change PIN
              </button>
            ) : null}
            <SettingsRow label="Hide amounts">
              <Switch
                aria-label="Hide amounts"
                checked={preferences.hideAmounts}
                onCheckedChange={(hideAmounts) => update({ hideAmounts })}
              />
            </SettingsRow>
          </SettingsGroup>
        </SettingsCol>
        <SettingsCol>
          <p className="rounded-lg border border-border bg-surface-1 p-4 text-sm text-label-secondary">
            App lock guards the screen on this device. It does not encrypt your data, so it is not a
            replacement for a device passcode.
          </p>
        </SettingsCol>
      </SettingsGrid>

      {mode === 'enable' ? <EnableSheet onClose={close} /> : null}
      {mode === 'disable' ? <DisableSheet onClose={close} /> : null}
      {mode === 'change' ? <ChangePinSheet onClose={close} /> : null}
    </Page>
  )
}

function useAppLockMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  successMessage: string,
  onClose: () => void,
  setFormError: (m: string | null) => void,
) {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: fn,
    meta: { silent: true },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.preferences() })
      toast.show(successMessage, 'success')
      onClose()
    },
    onError: (err) => setFormError(errorMessage(err)),
  })
}

function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm text-negative">
      {message}
    </p>
  ) : null
}

function EnableSheet({ onClose }: { onClose: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(enableSchema),
    defaultValues: { password: '', pin: '', confirm: '' },
  })
  const enable = useAppLockMutation(
    async (v: { password: string; pin: string }) =>
      api.POST('/me/app-lock', { body: { password: v.password, pin: v.pin } }),
    'App lock turned on',
    onClose,
    setFormError,
  )
  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && onClose()}
      title="Turn on app lock"
      description="Choose a 4 to 6 digit PIN. You'll be asked for it when you open the app."
      footer={
        <Button
          block
          disabled={enable.isPending}
          onClick={handleSubmit((v) => {
            setFormError(null)
            enable.mutate(v)
          })}
        >
          {enable.isPending ? 'Saving…' : 'Turn on'}
        </Button>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <FormError message={formError} />
        <Field label="Account password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        <Controller
          control={control}
          name="pin"
          render={({ field }) => (
            <div className="flex flex-col items-center gap-2">
              <PinPad label="New PIN" value={field.value} onChange={field.onChange} />
              {errors.pin ? (
                <p role="alert" className="text-sm text-negative">
                  {errors.pin.message}
                </p>
              ) : null}
            </div>
          )}
        />
        <Field label="Confirm PIN" error={errors.confirm?.message}>
          <Input
            inputMode="numeric"
            type="password"
            maxLength={6}
            autoComplete="off"
            {...register('confirm')}
          />
        </Field>
      </form>
    </SheetShell>
  )
}

function DisableSheet({ onClose }: { onClose: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(disableSchema), defaultValues: { password: '' } })
  const disable = useAppLockMutation(
    async (v: { password: string }) => api.DELETE('/me/app-lock', { body: v }),
    'App lock turned off',
    onClose,
    setFormError,
  )
  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && onClose()}
      title="Turn off app lock"
      description="Enter your account password to confirm."
      footer={
        <Button
          variant="destructive"
          block
          disabled={disable.isPending}
          onClick={handleSubmit((v) => {
            setFormError(null)
            disable.mutate(v)
          })}
        >
          {disable.isPending ? 'Saving…' : 'Turn off'}
        </Button>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <FormError message={formError} />
        <Field label="Account password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>
      </form>
    </SheetShell>
  )
}

function ChangePinSheet({ onClose }: { onClose: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changeSchema),
    defaultValues: { currentPin: '', newPin: '' },
  })
  const change = useAppLockMutation(
    async (v: { currentPin: string; newPin: string }) => api.PATCH('/me/app-lock/pin', { body: v }),
    'PIN changed',
    onClose,
    setFormError,
  )
  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && onClose()}
      title="Change PIN"
      footer={
        <Button
          block
          disabled={change.isPending}
          onClick={handleSubmit((v) => {
            setFormError(null)
            change.mutate(v)
          })}
        >
          {change.isPending ? 'Saving…' : 'Change PIN'}
        </Button>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <FormError message={formError} />
        <Field label="Current PIN" error={errors.currentPin?.message}>
          <Input
            inputMode="numeric"
            type="password"
            maxLength={6}
            autoComplete="off"
            {...register('currentPin')}
          />
        </Field>
        <Controller
          control={control}
          name="newPin"
          render={({ field }) => (
            <div className="flex flex-col items-center gap-2">
              <PinPad label="New PIN" value={field.value} onChange={field.onChange} />
              {errors.newPin ? (
                <p role="alert" className="text-sm text-negative">
                  {errors.newPin.message}
                </p>
              ) : null}
            </div>
          )}
        />
      </form>
    </SheetShell>
  )
}
