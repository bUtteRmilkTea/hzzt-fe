import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSession } from '@/app/providers/SessionProvider'
import { api } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { AuthCard, FormError } from './AuthCard'
import { type RegisterValues, registerSchema } from './schemas'
import { applyServerError } from './useServerErrors'

/** The browser's IANA timezone, sent to the backend at sign-up. */
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function RegisterScreen() {
  const { startSession } = useSession()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  const signUp = useMutation({
    mutationFn: async (values: RegisterValues) =>
      (await api.POST('/auth/register', { body: { ...values, timezone: browserTimezone() } })).data,
    meta: { silent: true },
    onSuccess: (auth) => auth && startSession(auth),
    onError: (err) =>
      setFormError(applyServerError(err, setError, ['name', 'email', 'password', 'timezone'])),
  })

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start tracking your money in a minute"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent">
            Sign in
          </Link>
        </>
      }
    >
      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null)
          signUp.mutate(values)
        })}
        className="flex flex-col gap-4"
      >
        <FormError message={formError} />
        <Field label="Name" error={errors.name?.message}>
          <Input autoComplete="name" {...register('name')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
        </Field>
        <Field label="Password" hint="At least 8 characters" error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <Button type="submit" block disabled={signUp.isPending}>
          {signUp.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  )
}
