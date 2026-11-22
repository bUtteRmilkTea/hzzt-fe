import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { LayoutProvider } from '@/shared/ui/layout'
import { PrivacyProvider } from '@/shared/ui/privacy'
import { ToastProvider } from '@/shared/ui/Toast'
import { QueryProvider } from './QueryProvider'
import { SessionProvider } from './SessionProvider'
import { ThemeProvider } from './ThemeProvider'

/** Provider order: theme and layout first, then privacy, motion, toasts, data, session. */
export function Providers({
  children,
  queryClient,
}: {
  children: ReactNode
  queryClient?: QueryClient
}) {
  return (
    <ThemeProvider>
      <LayoutProvider>
        <PrivacyProvider>
          <ToastProvider>
            <QueryProvider client={queryClient}>
              <SessionProvider>{children}</SessionProvider>
            </QueryProvider>
          </ToastProvider>
        </PrivacyProvider>
      </LayoutProvider>
    </ThemeProvider>
  )
}
