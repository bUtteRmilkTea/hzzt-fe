import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

export const buttonVariants = cva(
  'inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-full px-5 text-base font-semibold transition-[transform,background-color,opacity] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:border disabled:border-border-strong disabled:bg-surface-3 disabled:text-label-tertiary disabled:shadow-none disabled:hover:bg-surface-3 disabled:hover:opacity-100 disabled:active:scale-100',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-label hover:opacity-90',
        secondary: 'bg-surface-3 text-label hover:bg-border-strong',
        ghost: 'bg-transparent text-accent hover:bg-surface-3',
        destructive: 'bg-negative text-accent-label hover:opacity-90',
      },
      size: { md: 'min-h-12 px-5', sm: 'min-h-12 px-4 text-sm', icon: 'size-12 px-0' },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, block, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      {...(props.disabled ? { 'aria-disabled': true } : {})}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  )
}

/** One line under a disabled button saying why. Link it with the button's `aria-describedby`. */
export function DisabledReason({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="pt-2 text-center text-sm text-label-secondary">
      {children}
    </p>
  )
}
