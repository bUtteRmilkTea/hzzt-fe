import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordScreen } from '@/features/auth/ResetPasswordScreen'

export const Route = createFileRoute('/_guest/reset-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === 'string' && search.token ? { token: search.token } : {},
  component: ResetPasswordScreen,
})
