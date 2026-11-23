import * as RadixSwitch from '@radix-ui/react-switch'
import type { ComponentProps } from 'react'
import { cn } from './cn'

export function Switch({ className, ...props }: ComponentProps<typeof RadixSwitch.Root>) {
  return (
    // 44px hit area around the 31px visual track
    <RadixSwitch.Root
      className={cn(
        'relative inline-flex h-12 w-[58px] shrink-0 items-center justify-center rounded-full',
        className,
      )}
      {...props}
    >
      <span className="absolute inset-x-0 top-1/2 h-[31px] -translate-y-1/2 rounded-full bg-surface-3 transition-colors duration-150 [[data-state=checked]>&]:bg-accent" />
      <RadixSwitch.Thumb className="pointer-events-none absolute left-[5px] size-[27px] rounded-full bg-label shadow-card transition-transform duration-150 data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-bg" />
    </RadixSwitch.Root>
  )
}
