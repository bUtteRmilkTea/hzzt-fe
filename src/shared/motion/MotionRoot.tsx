import { LazyMotion } from 'motion/react'
import type { ReactNode } from 'react'

const loadFeatures = () => import('@/app/providers/motionFeatures').then((m) => m.default)

/** Provides the animation features to `m.*` components below. Only lazy chunks import this. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  )
}
