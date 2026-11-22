import { LazyMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { LayoutProvider } from '@/shared/ui/layout'
import { PrivacyProvider } from '@/shared/ui/privacy'
import { ToastProvider } from '@/shared/ui/Toast'
import { QueryProvider } from './QueryProvider'
import { SessionProvider } from './SessionProvider'
import { ThemeProvider } from './ThemeProvider'

const loadMotionFeatures = () => import('./motionFeatures').then((m) => m.default)

/** Provider order: theme and layout first, then privacy, motion, toasts, data, session. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LayoutProvider>
        <PrivacyProvider>
          <LazyMotion features={loadMotionFeatures} strict>
            <ToastProvider>
              <QueryProvider>
                <SessionProvider>{children}</SessionProvider>
              </QueryProvider>
            </ToastProvider>
          </LazyMotion>
        </PrivacyProvider>
      </LayoutProvider>
    </ThemeProvider>
  )
}
