import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordScreen } from '@/features/auth/ForgotPasswordScreen'

export const Route = createFileRoute('/_guest/forgot-password')({
  component: ForgotPasswordScreen,
})
