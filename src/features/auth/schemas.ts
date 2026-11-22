import { z } from 'zod'

// Limits mirror the backend's auth DTOs (swagger: maxLength) and password policy (8-128).
const email = z.email('Enter a valid email address').max(254, 'Email is too long')
const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password').max(128),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name').max(60, 'Use at most 60 characters'),
    email,
    password,
  })
  .refine((v) => v.password.toLowerCase() !== v.email.toLowerCase(), {
    path: ['password'],
    message: 'Password cannot be the same as your email',
  })
export type RegisterValues = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({ email })
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({ newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
