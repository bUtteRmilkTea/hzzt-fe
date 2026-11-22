/**
 * The single source of cache keys. Every space-scoped key starts with the space id,
 * so switching spaces can never show another space's data (plan 5.1).
 */
export const queryKeys = {
  me: () => ['me'] as const,
  preferences: () => ['me', 'preferences'] as const,
  spaces: () => ['spaces'] as const,
  currencies: () => ['currencies'] as const,
  categorySuggestions: (type: string) => ['category-suggestions', type] as const,
  investmentTypes: () => ['investment-types'] as const,
  sharedInvitations: () => ['shared-investment-invitations'] as const,
  instrumentSearch: (kind: string, q: string) => ['instrument-search', kind, q] as const,
  walletCardPresets: () => ['wallet-card-presets'] as const,
  walletCardTemplates: () => ['wallet-card-templates'] as const,
  space: (spaceId: string) => ({
    /** Prefix of every key for this space: used to drop its cache on a switch. */
    all: () => ['space', spaceId] as const,
    members: () => ['space', spaceId, 'members'] as const,
    invitation: () => ['space', spaceId, 'invitation'] as const,
    manualRates: () => ['space', spaceId, 'manual-rates'] as const,
    categories: (type?: string, stats?: boolean) =>
      ['space', spaceId, 'categories', type, stats] as const,
    categoriesAll: () => ['space', spaceId, 'categories'] as const,
    investments: () => ['space', spaceId, 'investments'] as const,
    investment: (id: string) => ['space', spaceId, 'investments', id] as const,
    /** Under `investments()` so every money-moving write refreshes it too. */
    investmentWrappers: () => ['space', spaceId, 'investments', 'wrappers'] as const,
    participants: (id: string) => ['space', spaceId, 'investments', id, 'participants'] as const,
    wallets: () => ['space', spaceId, 'wallets'] as const,
    wallet: (id: string) => ['space', spaceId, 'wallets', id] as const,
    transactions: (filters?: unknown) => ['space', spaceId, 'transactions', filters] as const,
    netWorth: () => ['space', spaceId, 'net-worth'] as const,
    netWorthSummary: () => ['space', spaceId, 'net-worth', 'summary'] as const,
    netWorthHistory: (range: string) => ['space', spaceId, 'net-worth', 'history', range] as const,
    manualAssets: (kind?: string) => ['space', spaceId, 'manual-assets', kind] as const,
    manualAssetsAll: () => ['space', spaceId, 'manual-assets'] as const,
    manualAsset: (id: string) => ['space', spaceId, 'manual-assets', 'one', id] as const,
    goal: (id: string) => ['space', spaceId, 'goals', id] as const,
    dashboard: () => ['space', spaceId, 'dashboard'] as const,
    dashboardView: (view: string, params: unknown) =>
      ['space', spaceId, 'dashboard', view, params] as const,
    goals: () => ['space', spaceId, 'goals'] as const,
  }),
}
