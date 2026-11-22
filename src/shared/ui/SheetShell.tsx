import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { cn } from './cn'
import { useLayout } from './layout'

export interface SheetShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** Sticky footer, usually the primary action. */
  footer?: ReactNode
  /** Optional element that opens the sheet. */
  trigger?: ReactNode
}

const closeButton =
  'inline-flex size-11 items-center justify-center rounded-full text-label-secondary hover:bg-surface-3'

/**
 * One API, two presentations: a drag-to-dismiss bottom sheet (Vaul) below 1024px
 * and a right-side drawer (Radix) at 1024px and above. Both trap focus, close on
 * Escape and lock page scroll.
 */
export function SheetShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
}: SheetShellProps) {
  const { isWide } = useLayout()

  if (isWide) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
        <Dialog.Portal>
          <Dialog.Overlay className="drawer-overlay fixed inset-0 z-50 bg-overlay" />
          <Dialog.Content
            className="drawer-slide fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(28rem,100vw)] flex-col border-l border-border bg-surface-2 shadow-sheet"
            {...(description ? {} : { 'aria-describedby': undefined })}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-5">
              <div>
                <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 text-sm text-label-secondary">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>
              <Dialog.Close className={closeButton} aria-label="Close">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
            {footer ? <div className="border-t border-border px-6 py-4">{footer}</div> : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Drawer.Trigger asChild>{trigger}</Drawer.Trigger> : null}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-xl border border-b-0 border-border bg-surface-2 shadow-sheet outline-none',
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <Drawer.Handle className="mt-2 mb-1 !h-1.5 !w-10 !bg-border-strong" />
          <div className="flex items-start justify-between gap-4 px-5 pt-2">
            <div>
              <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-1 text-sm text-label-secondary">
                  {description}
                </Drawer.Description>
              ) : null}
            </div>
            <Drawer.Close className={closeButton} aria-label="Close">
              <X className="size-5" />
            </Drawer.Close>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="pb-safe border-t border-border bg-surface-2 px-5 py-4">{footer}</div>
          ) : (
            <div className="pb-safe" />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
