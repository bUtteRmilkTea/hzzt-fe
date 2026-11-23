import type { components } from '@/shared/api/schema'

type S = components['schemas']

/** Mirrors the backend's static investment type metadata (internal/investments/types.go). */
export const metas: S['investments.TypeMeta'][] = [
  {
    assetType: 'CRYPTO',
    label: 'Crypto',
    quoteCurrency: 'USD',
    quoteCurrencyEditable: false,
    supportsAutoPrice: true,
    quantityMode: 'QUANTITY',
    quantityScale: 8,
    symbolRequired: true,
    defaultIcon: '🪙',
    defaults: { priceMode: 'MANUAL', estimatedAnnualChangePct: '5.5', fees: '0' },
    detailFields: [
      { name: 'exchangeOrWallet', label: 'Exchange or wallet', kind: 'TEXT' },
      { name: 'network', label: 'Network', kind: 'TEXT' },
      { name: 'stakedQuantity', label: 'Staked quantity', kind: 'DECIMAL' },
    ],
  },
  {
    assetType: 'ID_STOCK',
    label: 'Indonesian stock',
    quoteCurrency: 'IDR',
    quoteCurrencyEditable: false,
    supportsAutoPrice: false,
    quantityMode: 'LOTS',
    quantityScale: 0,
    lotSize: 100,
    symbolRequired: true,
    defaultIcon: '🇮🇩',
    defaults: { priceMode: 'MANUAL', estimatedAnnualChangePct: '5.5', fees: '0' },
    detailFields: [
      { name: 'broker', label: 'Broker', kind: 'TEXT' },
      { name: 'lots', label: 'Lots', kind: 'DECIMAL', required: true },
    ],
  },
  {
    assetType: 'US_STOCK',
    label: 'US stock',
    quoteCurrency: 'USD',
    quoteCurrencyEditable: false,
    supportsAutoPrice: true,
    quantityMode: 'QUANTITY',
    quantityScale: 1,
    symbolRequired: true,
    defaultIcon: '🇺🇸',
    defaults: { priceMode: 'MANUAL', estimatedAnnualChangePct: '5.5', fees: '0' },
    detailFields: [
      { name: 'exchange', label: 'Exchange', kind: 'TEXT', required: true },
      { name: 'platform', label: 'Platform', kind: 'TEXT' },
    ],
  },
  {
    assetType: 'MUTUAL_FUND',
    label: 'Mutual fund',
    quoteCurrencyEditable: true,
    supportsAutoPrice: false,
    quantityMode: 'QUANTITY',
    symbolRequired: false,
    defaultIcon: '💼',
    defaults: { priceMode: 'MANUAL', estimatedAnnualChangePct: '5.5', fees: '0' },
    detailFields: [
      { name: 'fundManager', label: 'Fund manager', kind: 'TEXT' },
      {
        name: 'fundType',
        label: 'Fund type',
        kind: 'ENUM',
        required: true,
        options: ['MONEY_MARKET', 'FIXED_INCOME', 'EQUITY', 'BALANCED', 'OTHER'],
      },
      { name: 'navDate', label: 'NAV date', kind: 'DATE' },
    ],
  },
  {
    assetType: 'GLOBAL_ETF',
    label: 'Global ETF',
    quoteCurrency: 'USD',
    quoteCurrencyEditable: false,
    supportsAutoPrice: true,
    quantityMode: 'QUANTITY',
    symbolRequired: true,
    defaultIcon: '🌐',
    defaults: { priceMode: 'MANUAL', estimatedAnnualChangePct: '5.5', fees: '0' },
    detailFields: [
      { name: 'exchange', label: 'Exchange', kind: 'TEXT', required: true },
      { name: 'platform', label: 'Platform', kind: 'TEXT' },
      { name: 'expenseRatioPct', label: 'Expense ratio (%)', kind: 'DECIMAL' },
      { name: 'assetClass', label: 'Asset class', kind: 'TEXT' },
    ],
  },
]

/** The real valuation shape; the spec types it as an opaque object. */
/** `never` lets these opaque-in-the-spec objects drop into the typed DTOs. */
export const valuation = (over: Record<string, unknown> = {}): never =>
  ({
    price: '65000',
    priceSource: 'MARKET',
    priceAsOf: '2026-11-19T10:00:00Z',
    isStale: false,
    marketValue: '650',
    costBasis: '500',
    unrealizedPl: '150',
    unrealizedPlPct: '30',
    base: {
      currency: 'IDR',
      marketValue: '10400000',
      costBasis: '8000000',
      unrealizedPl: '2400000',
      fxRate: '16000',
    },
    warnings: [],
    ...over,
  }) as never

export const btc: S['investments.InvestmentDTO'] = {
  id: 'i-1',
  name: 'Bitcoin',
  symbol: 'BTC',
  icon: '🪙',
  assetType: 'CRYPTO',
  priceMode: 'AUTO',
  quoteCurrency: 'USD',
  quantity: '0.01',
  avgBuyPrice: '50000',
  fees: '0',
  ownership: 'OWNER',
  isShared: false,
  myShareBps: 10000,
  valuation: valuation(),
  totalValuation: valuation(),
  details: { network: 'Bitcoin', stakedQuantity: '0.002' } as never,
  instrumentId: 'inst-btc',
  realizedPl: { amount: '25', base: '400000', currency: 'USD', sells: 1 },
}

export const bbca: S['investments.InvestmentDTO'] = {
  id: 'i-2',
  name: 'BCA',
  symbol: 'BBCA',
  icon: '🇮🇩',
  assetType: 'ID_STOCK',
  priceMode: 'MANUAL',
  quoteCurrency: 'IDR',
  quantity: '200',
  avgBuyPrice: '9000',
  fees: '0',
  ownership: 'OWNER',
  isShared: false,
  myShareBps: 10000,
  details: { lots: 2, broker: 'Stockbit' } as never,
  valuation: valuation({
    price: '9500',
    priceSource: 'MANUAL',
    marketValue: '1900000',
    costBasis: '1800000',
    unrealizedPl: '100000',
    unrealizedPlPct: '5.56',
    base: null,
  }),
  totalValuation: valuation({ marketValue: '1900000', base: null }),
}

export const sharedIn: S['investments.InvestmentDTO'] = {
  id: 'i-3',
  name: 'Family ETF',
  symbol: 'VOO',
  icon: '🌐',
  assetType: 'GLOBAL_ETF',
  priceMode: 'MANUAL',
  quoteCurrency: 'USD',
  quantity: '10',
  avgBuyPrice: '400',
  fees: '0',
  ownership: 'SHARED_IN',
  isShared: true,
  myShareBps: 2500,
  valuation: valuation({
    marketValue: '1000',
    costBasis: '1000',
    unrealizedPl: '0',
    unrealizedPlPct: '0',
    price: '400',
  }),
  totalValuation: valuation({
    marketValue: '4000',
    costBasis: '4000',
    unrealizedPl: '0',
    unrealizedPlPct: '0',
    price: '400',
  }),
}

export const list = (
  items: S['investments.InvestmentDTO'][],
  summary: Partial<S['investments.Summary']> = {},
): S['investments.ListResponse'] => ({
  items,
  summary: {
    currency: 'IDR',
    totalValue: '12300000',
    totalCost: '9800000',
    unrealizedPl: '2500000',
    unrealizedPlPct: '25.51',
    warnings: [],
    ...summary,
  },
})
