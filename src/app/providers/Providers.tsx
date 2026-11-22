import { LazyMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { LayoutProvider } from '@/shared/ui/layout'
import { PrivacyProvider } from '@/shared/ui/privacy'
import { ToastProvider } from '@/shared/ui/Toast'
import { ThemeProvider } from './ThemeProvider'

const loadMotionFeatures = () => import('./motionFeatures').then((m) => m.default)

/** Provider order: theme and layout first, then privacy, motion and toasts. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LayoutProvider>
        <PrivacyProvider>
          <LazyMotion features={loadMotionFeatures} strict>
            <ToastProvider>{children}</ToastProvider>
          </LazyMotion>
        </PrivacyProvider>
      </LayoutProvider>
    </ThemeProvider>
  )
}
