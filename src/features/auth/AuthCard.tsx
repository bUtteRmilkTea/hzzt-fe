import type { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-label-secondary">{subtitle}</p> : null}
      </div>
      {children}
      {footer ? <p className="text-center text-sm text-label-secondary">{footer}</p> : null}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-md border border-negative bg-surface-1 px-4 py-3 text-sm text-negative"
    >
      {message}
    </p>
  )
}
