import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './Button'
import { cn } from './cn'
import { EmojiPicker } from './EmojiPicker'

interface EmojiPopoverProps {
  value: string
  onChange: (emoji: string) => void
  label?: string
  className?: string
}

/**
 * The icon as a tile. Tapping it opens the emoji grid in a popover, so the grid no longer takes a
 * third of the form. Escape or tapping outside closes it and returns focus to the tile.
 */
export function EmojiPopover({ value, onChange, label = 'Icon', className }: EmojiPopoverProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const tile = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        tile.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        ref={tile}
        type="button"
        aria-label={`${label}: ${value}, change`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded-md border border-border bg-surface-3 text-2xl hover:border-border-strong"
      >
        <span aria-hidden>{value}</span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          className="absolute top-full left-0 z-30 mt-2 flex w-[min(21rem,calc(100vw-2rem))] flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3 shadow-sheet"
        >
          <EmojiPicker label={label} value={value} onChange={onChange} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setOpen(false)
              tile.current?.focus()
            }}
          >
            Done
          </Button>
        </div>
      ) : null}
    </div>
  )
}
