import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useSpring } from '@/shared/motion'
import { MotionRoot } from '@/shared/motion/MotionRoot'
import { cn } from './cn'

export interface ToastItem {
  id: number
  message: string
  tone: 'default' | 'error' | 'success'
}

/** The animated toast list. Lazy-loaded by ToastProvider so motion stays out of the initial bundle. */
export default function ToastList({ items }: { items: ToastItem[] }) {
  const transition = useSpring('list')
  return (
    <MotionRoot>
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <m.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={transition}
            className={cn(
              'pointer-events-auto max-w-md rounded-full border px-5 py-3 text-sm font-medium shadow-sheet',
              t.tone === 'error'
                ? 'border-negative bg-surface-2 text-negative'
                : t.tone === 'success'
                  ? 'border-positive bg-surface-2 text-positive'
                  : 'border-border bg-surface-2 text-label',
            )}
          >
            {t.message}
          </m.div>
        ))}
      </AnimatePresence>
    </MotionRoot>
  )
}
