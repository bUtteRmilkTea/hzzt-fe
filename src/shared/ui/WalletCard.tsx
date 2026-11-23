import { Star } from 'lucide-react'
import { Amount } from './Amount'
import { type CardStyleDTO, resolveCardStyle, templateScrim } from './cardStyle'
import { cn } from './cn'

const TYPE_LABEL: Record<string, string> = {
  BANK: 'Bank',
  E_WALLET: 'E-wallet',
  CASH: 'Cash',
  OTHER: 'Other',
}

export interface WalletCardProps {
  name: string
  icon: string
  balance: string
  currency: string
  type: string
  cardStyle: CardStyleDTO | undefined
  isFavorite?: boolean
  /** Per-user hide flags (all shown by default). The balance is always shown. */
  display?: { hideLogo?: boolean; hideName?: boolean; hideType?: boolean }
  /** `compact` stops the card growing with its container (wallet detail, wide screens). */
  size?: 'default' | 'compact'
  className?: string
}

/** The wallet card: icon, name, balance and type over a solid, gradient or template background. */
export function WalletCard({
  name,
  icon,
  balance,
  currency,
  type,
  cardStyle,
  isFavorite,
  display,
  size = 'default',
  className,
}: WalletCardProps) {
  const { background, tone } = resolveCardStyle(cardStyle)
  return (
    <div
      data-tone={tone}
      style={{ background }}
      className={cn(
        'relative isolate flex aspect-[1.7/1] w-full flex-col justify-between overflow-hidden rounded-lg p-4 shadow-card',
        size === 'compact' && 'max-w-sm',
        tone === 'light' ? 'text-white' : 'text-black',
        className,
      )}
    >
      {cardStyle?.mode === 'TEMPLATE' ? (
        <span
          aria-hidden
          data-testid="card-scrim"
          style={{ background: templateScrim(tone) }}
          className="pointer-events-none absolute inset-0 -z-10"
        />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          {display?.hideLogo ? null : (
            <span aria-hidden className="text-xl">
              {icon}
            </span>
          )}
          {display?.hideName ? null : <span className="truncate">{name}</span>}
        </span>
        {isFavorite ? (
          <Star aria-label="Favourite" className="size-4 shrink-0 fill-current" />
        ) : null}
      </div>
      <div>
        {display?.hideType ? null : (
          <p className="text-xs opacity-80">{TYPE_LABEL[type] ?? type}</p>
        )}
        <Amount value={balance} currency={currency} className="text-xl font-medium" />
      </div>
    </div>
  )
}
