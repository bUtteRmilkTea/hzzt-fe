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
import { type LoginValues, loginSchema } from './schemas'
import { applyServerError } from './useServerErrors'

export function LoginScreen() {
  const { startSession } = useSession()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const login = useMutation({
    mutationFn: async (body: LoginValues) => (await api.POST('/auth/login', { body })).data,
    meta: { silent: true }, // errors are shown inline below
    onSuccess: (auth) => auth && startSession(auth),
    onError: (err) => setFormError(applyServerError(err, setError, ['email', 'password'])),
  })

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your account"
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-semibold text-accent">
            Create an account
          </Link>
        </>
      }
    >
      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null)
          login.mutate(values)
        })}
        className="flex flex-col gap-4"
      >
        <FormError message={formError} />
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        <div className="text-right text-sm">
          <Link to="/forgot-password" className="font-medium text-accent">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" block disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  )
}
