import { Button } from '@/shared/ui/Button'
import { SheetShell } from '@/shared/ui/SheetShell'

interface AddSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Placeholder for the real add-transaction sheet built in phase F5. */
export default function AddSheet({ open, onOpenChange }: AddSheetProps) {
  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add transaction"
      description="The real form arrives in phase F5."
      footer={
        <Button block onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <p className="text-label-secondary">Expense, income and transfer entry will live here.</p>
    </SheetShell>
  )
}
