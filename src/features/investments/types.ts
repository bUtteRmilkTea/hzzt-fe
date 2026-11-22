import type { components } from '@/shared/api/schema'

type S = components['schemas']

export type InvestmentDTO = S['investments.InvestmentDTO']
export type TypeMeta = S['investments.TypeMeta']
export type FieldMeta = S['investments.FieldMeta']
export type ParticipantDTO = S['investments.ParticipantDTO']
export type AssetType = 'CRYPTO' | 'ID_STOCK' | 'US_STOCK' | 'MUTUAL_FUND' | 'GLOBAL_ETF'

/**
 * Seam for backend phase P18 (investment accounts). The field is typed but unused: when accounts
 * land, grouping by account is a change to `groupInvestments`, not a rewrite of the list.
 */
export type InvestmentView = InvestmentDTO & { accountId?: string }

/** The spec types `valuation` as an opaque object; this is the real shape (backend valuation.go). */
export interface Valuation {
  price: string
  priceSource: 'MARKET' | 'MANUAL' | 'MANUAL_VALUE'
  priceAsOf: string | null
  isStale: boolean
  marketValue: string
  costBasis: string
  unrealizedPl: string
  unrealizedPlPct: string | null
  base: {
    currency: string
    marketValue: string
    costBasis: string
    unrealizedPl: string
    fxRate: string
  } | null
  warnings: Array<{ code?: string; label?: string; message?: string }>
}
