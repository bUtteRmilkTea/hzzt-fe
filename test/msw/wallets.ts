import type { components } from '@/shared/api/schema'
import { PALETTE } from '@/shared/ui/palette'

type S = components['schemas']

export const cash = {
  id: 'w-1',
  name: 'Cash',
  icon: '💵',
  type: 'CASH',
  currency: 'IDR',
  balance: '250000',
  available: '250000',
  reserved: '0',
  sortOrder: 1,
  isFavorite: false,
  cardStyle: { mode: 'SOLID', color: PALETTE[7] },
} satisfies S['wallets.WalletDTO']

export const bank = {
  id: 'w-2',
  name: 'BCA',
  icon: '🏦',
  type: 'BANK',
  currency: 'IDR',
  balance: '1500000',
  available: '1500000',
  reserved: '0',
  sortOrder: 0,
  isFavorite: false,
  cardStyle: { mode: 'GRADIENT', colors: [PALETTE[0], PALETTE[4]], direction: 'SE' },
} satisfies S['wallets.WalletDTO']

export const savings = {
  id: 'w-3',
  name: 'Savings',
  icon: '💰',
  type: 'BANK',
  currency: 'USD',
  balance: '1234.50',
  available: '1234.50',
  reserved: '0',
  sortOrder: 2,
  isFavorite: true,
  cardStyle: { mode: 'TEMPLATE', templateId: 'marble' },
} satisfies S['wallets.WalletDTO']

/** The API sends aggregate totals as strings, but the generated type says number. */
const money = (v: string) => v as unknown as number

export function walletList(
  items: S['wallets.WalletDTO'][],
  total = { total: '1750000', currency: 'IDR', warnings: [] as S['currency.Warning'][] },
): S['wallets.ListResponse'] {
  return { items, total: { ...total, total: money(total.total) } }
}

export const presets = [
  { id: 'ocean', name: 'Ocean', colors: [PALETTE[8], PALETTE[9]], direction: 'E' },
  { id: 'sunset', name: 'Sunset', colors: [PALETTE[4], PALETTE[5]], direction: 'SW' },
] satisfies S['wallets.Preset'][]

export const templates = [
  { id: 'classic', name: 'Classic' },
  { id: 'marble', name: 'Marble' },
] satisfies S['wallets.Template'][]

export function txn(
  over: Partial<S['transactions.TransactionDTO']> = {},
): S['transactions.TransactionDTO'] {
  return {
    id: 't-1',
    type: 'EXPENSE',
    direction: 'OUT',
    amount: '50000',
    currency: 'IDR',
    title: 'Lunch',
    occurredAt: '2026-11-18T12:30:00Z',
    category: { id: 'c-1', name: 'Food', icon: '🍜', color: PALETTE[5] },
    ...over,
  }
}
