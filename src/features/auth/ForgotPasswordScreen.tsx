import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { api } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { AuthCard, FormError } from './AuthCard'
import { type ForgotPasswordValues, forgotPasswordSchema } from './schemas'
import { applyServerError } from './useServerErrors'

export function ForgotPasswordScreen() {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) })

  const request = useMutation({
    mutationFn: async (body: ForgotPasswordValues) =>
      (await api.POST('/auth/forgot-password', { body })).data,
    meta: { silent: true },
    onError: (err) => setFormError(applyServerError(err, setError, ['email'])),
  })

  const backToLogin = (
    <Link to="/login" className="font-semibold text-accent">
      Back to sign in
    </Link>
  )

  if (request.isSuccess) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="If an account exists for that address, we've sent a link to reset your password."
        footer={backToLogin}
      >
        <span />
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link"
      footer={backToLogin}
    >
      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null)
          request.mutate(values)
        })}
        className="flex flex-col gap-4"
      >
        <FormError message={formError} />
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
        </Field>
        <Button type="submit" block disabled={request.isPending}>
          {request.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthCard>
  )
}
