import { Button } from './Button'
import { SheetShell } from './SheetShell'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            block
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? 'Please wait…' : confirmLabel}
          </Button>
          <Button variant="ghost" block onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      }
    >
      <span />
    </SheetShell>
  )
}
