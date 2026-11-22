import { format, parseISO } from 'date-fns'
import type { components } from '@/shared/api/schema'
import { Amount } from './Amount'
import { cn } from './cn'

export type TransactionDTO = components['schemas']['transactions.TransactionDTO']

const TYPE_LABEL: Record<string, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Adjustment',
  OPENING_BALANCE: 'Opening balance',
}

/** Display title: the user's title, else the category, else the type. */
export function transactionTitle(t: TransactionDTO): string {
  return t.title || t.category?.name || TYPE_LABEL[t.type ?? ''] || 'Transaction'
}

/** Signed amount for display: outflows are negative. */
export function signedAmount(t: TransactionDTO): string {
  const amount = t.amount ?? '0'
  return t.direction === 'OUT' && !amount.startsWith('-') ? `-${amount}` : amount
}

/** Outflows are always red, income green, transfers and adjustments neutral. */
export function amountTone(t: TransactionDTO): 'auto' | 'expense' | 'neutral' {
  if (t.type === 'EXPENSE') return 'expense'
  if (t.type === 'INCOME') return 'auto'
  return 'neutral'
}

export function TransactionRow({
  transaction: t,
  pending,
  showWallet,
}: {
  transaction: TransactionDTO
  /** An optimistic row that the server has not confirmed yet. */
  pending?: boolean
  /** Show the wallet as its own column from 1024px (History). */
  showWallet?: boolean
}) {
  return (
    <div
      data-pending={pending || undefined}
      className={cn('flex h-16 items-center gap-3 py-2', pending && 'opacity-60')}
    >
      <span
        aria-hidden
        style={t.category?.color ? { backgroundColor: t.category.color } : undefined}
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full text-lg',
          !t.category?.color && 'bg-surface-3',
        )}
      >
        {t.category?.icon ?? '💱'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{transactionTitle(t)}</p>
        <p className="truncate text-sm text-label-secondary">
          {pending ? 'Saving…' : (TYPE_LABEL[t.type ?? ''] ?? t.type)}
          {!pending && t.occurredAt ? ` · ${format(parseISO(t.occurredAt), 'HH:mm')}` : ''}
        </p>
      </div>
      {showWallet && t.wallet?.name ? (
        <p
          data-testid="row-wallet"
          className="hidden w-36 shrink-0 truncate text-sm text-label-secondary lg:block"
        >
          {t.wallet.name}
        </p>
      ) : null}
      <Amount
        value={signedAmount(t)}
        currency={t.currency ?? ''}
        tone={amountTone(t)}
        className="font-medium"
      />
    </div>
  )
}

interface DayGroupHeaderProps {
  /** `YYYY-MM-DD` */
  date: string
  /** The day's totals from the daily summary, in `currency`. */
  income?: string
  expense?: string
  currency?: string
  sticky?: boolean
  /** Heading level: 2 under a page title, 3 under a section heading. */
  level?: 2 | 3
}

/** "Mon, 3 Nov" heading for a day's transactions, with the day's money in and out. */
export function DayGroupHeader({
  date,
  income,
  expense,
  currency,
  sticky = true,
  level = 3,
}: DayGroupHeaderProps) {
  const Heading = level === 2 ? 'h2' : 'h3'
  const hasTotals = currency && (income !== undefined || expense !== undefined)
  return (
    <div
      className={cn(
        'flex h-11 items-center justify-between bg-bg text-sm',
        sticky && 'sticky top-14',
      )}
    >
      <Heading className="font-semibold text-label-secondary">
        {format(parseISO(`${date}T12:00:00`), 'EEE, d MMM')}
      </Heading>
      {hasTotals ? (
        <p className="flex gap-3 text-label-secondary">
          {income !== undefined && income !== '0' ? (
            <span>
              In <Amount value={income} currency={currency} className="text-positive" />
            </span>
          ) : null}
          {expense !== undefined && expense !== '0' ? (
            <span>
              Out <Amount value={expense} currency={currency} className="text-negative" />
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
