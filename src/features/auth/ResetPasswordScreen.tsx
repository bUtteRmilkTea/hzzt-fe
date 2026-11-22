import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { api } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { useToast } from '@/shared/ui/Toast'
import { AuthCard, FormError } from './AuthCard'
import { type ResetPasswordValues, resetPasswordSchema } from './schemas'
import { applyServerError } from './useServerErrors'

export function ResetPasswordScreen() {
  const { token } = useSearch({ from: '/_guest/reset-password' })
  const navigate = useNavigate()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) })

  const reset = useMutation({
    mutationFn: async (values: ResetPasswordValues) => {
      if (!token) throw new Error('missing token')
      await api.POST('/auth/reset-password', { body: { token, newPassword: values.newPassword } })
    },
    meta: { silent: true },
    onSuccess: () => {
      toast.show('Password updated. Please sign in.', 'success')
      navigate({ to: '/login' })
    },
    onError: (err) => setFormError(applyServerError(err, setError, ['newPassword'])),
  })

  if (!token) {
    return (
      <AuthCard
        title="Link not valid"
        subtitle="This password reset link is missing its token. Request a new one."
        footer={
          <Link to="/forgot-password" className="font-semibold text-accent">
            Request a new link
          </Link>
        }
      >
        <span />
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Choose a new password" subtitle="You'll be signed out of other devices">
      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null)
          reset.mutate(values)
        })}
        className="flex flex-col gap-4"
      >
        <FormError message={formError} />
        <Field
          label="New password"
          hint="At least 8 characters"
          error={errors.newPassword?.message}
        >
          <Input type="password" autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </Field>
        <Button type="submit" block disabled={reset.isPending}>
          {reset.isPending ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </AuthCard>
  )
}
