import { Link } from '@tanstack/react-router'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import * as m from 'motion/react-m'
import { useChartWidth } from '@/shared/charts/useChartWidth'
import { useSpring } from '@/shared/motion'
import { Button } from '@/shared/ui/Button'
import { WalletCard } from '@/shared/ui/WalletCard'
import { prefsOf } from './display'
import type { WalletDTO } from './hooks'

/** Visible strip of every card but the last while collapsed. */
export const EDGE_PX = 56
const GAP_PX = 12
const ASPECT = 1.7

interface WalletStackProps {
  wallets: readonly WalletDTO[]
  spaceId: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /** Reorder mode forces the stack open (the up/down buttons need full cards). */
  forceExpanded?: boolean
  /** Rendered beside each card when expanded (reorder buttons). */
  renderAside?: (w: WalletDTO, index: number) => React.ReactNode
  selectedId?: string | null
  onSelect?: (id: string) => void
}

/**
 * Overlapped cards that only show their top edge until expanded. Layout only: each card is still a
 * link to its wallet. While collapsed a click on any card expands the deck instead of navigating.
 */
export function WalletStack({
  wallets,
  spaceId,
  expanded,
  onExpandedChange,
  forceExpanded,
  renderAside,
  selectedId,
  onSelect,
}: WalletStackProps) {
  const spring = useSpring('list')
  const { ref, width } = useChartWidth(340)
  const open = expanded || Boolean(forceExpanded)
  const cardH = Math.round(width / ASPECT)
  const n = wallets.length
  const collapsedH = cardH + (n - 1) * EDGE_PX
  const expandedH = n * cardH + (n - 1) * GAP_PX

  return (
    <div className="flex flex-col gap-3">
      {n > 1 ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls="wallet-stack"
            disabled={forceExpanded}
            onClick={() => onExpandedChange(!expanded)}
          >
            {open ? (
              <ChevronsDownUp aria-hidden className="size-4" />
            ) : (
              <ChevronsUpDown aria-hidden className="size-4" />
            )}
            {open ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      ) : null}
      <div ref={ref} className="w-full">
        <m.ul
          id="wallet-stack"
          data-expanded={open}
          className="relative"
          initial={false}
          animate={{ height: open ? expandedH : collapsedH }}
          transition={spring}
        >
          {wallets.map((w, i) => (
            <m.li
              key={w.id}
              data-testid="wallet-stack-item"
              className="absolute inset-x-0 top-0 flex items-center gap-2"
              style={{ zIndex: i + 1, height: cardH }}
              initial={false}
              animate={{ y: open ? i * (cardH + GAP_PX) : i * EDGE_PX }}
              transition={spring}
            >
              <Link
                to="/s/$spaceId/wallets/$id"
                params={{ spaceId, id: w.id as string }}
                aria-label={`${w.name}, open wallet`}
                className="block min-w-0 flex-1"
                onClick={(e) => {
                  if (!open) {
                    e.preventDefault()
                    onExpandedChange(true)
                    return
                  }
                  onSelect?.(w.id as string)
                }}
              >
                <WalletCard
                  name={w.name ?? ''}
                  icon={w.icon ?? '💳'}
                  balance={w.balance ?? '0'}
                  currency={w.currency ?? ''}
                  type={w.type ?? 'OTHER'}
                  cardStyle={w.cardStyle}
                  isFavorite={w.isFavorite}
                  display={prefsOf(w)}
                  className={selectedId === w.id ? 'ring-2 ring-label' : undefined}
                />
              </Link>
              {open ? renderAside?.(w, i) : null}
            </m.li>
          ))}
        </m.ul>
      </div>
    </div>
  )
}
