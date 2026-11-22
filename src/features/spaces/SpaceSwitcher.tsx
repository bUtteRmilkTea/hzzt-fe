import { Check, ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/ui/cn'
import { DEFAULT_SPACE_COLOR } from '@/shared/ui/palette'
import { SheetShell } from '@/shared/ui/SheetShell'
import { CreateSpaceSheet } from './CreateSpaceSheet'

export function SpaceAvatar({
  emoji,
  color,
  className,
}: {
  emoji: string
  color: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: color }}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-lg',
        className,
      )}
    >
      {emoji}
    </span>
  )
}

/** Header control: shows the active space and opens the list of spaces. */
export function SpaceSwitcher() {
  const { space, spaces, switchSpace } = useSpace()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Switch space. Current space: ${space.name}`}
        className="flex min-h-11 items-center gap-2 rounded-full pr-3 hover:bg-surface-3"
      >
        <SpaceAvatar emoji={space.avatarEmoji} color={space.avatarColor} />
        <span className="max-w-40 truncate font-semibold">{space.name}</span>
        <ChevronDown aria-hidden className="size-4 text-label-tertiary" />
      </button>

      <SheetShell
        open={open}
        onOpenChange={setOpen}
        title="Your spaces"
        footer={
          <Button
            variant="secondary"
            block
            onClick={() => {
              setOpen(false)
              setCreating(true)
            }}
          >
            <Plus aria-hidden className="size-5" />
            Create space
          </Button>
        }
      >
        <ul className="flex flex-col gap-1">
          {spaces.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                aria-current={s.id === space.id ? 'true' : undefined}
                onClick={async () => {
                  setOpen(false)
                  if (s.id && s.id !== space.id) await switchSpace(s.id)
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-surface-3"
              >
                <SpaceAvatar
                  emoji={s.avatarEmoji ?? '🏠'}
                  color={s.avatarColor ?? DEFAULT_SPACE_COLOR}
                />
                <span className="flex-1">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-sm text-label-secondary">
                    {s.role === 'OWNER' ? 'Owner' : 'Member'} · {s.memberCount ?? 1}{' '}
                    {(s.memberCount ?? 1) === 1 ? 'member' : 'members'}
                  </span>
                </span>
                {s.id === space.id ? <Check aria-hidden className="size-5 text-accent" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </SheetShell>

      {creating ? <CreateSpaceSheet onClose={() => setCreating(false)} /> : null}
    </>
  )
}
