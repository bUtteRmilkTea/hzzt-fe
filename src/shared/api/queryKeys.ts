/**
 * The single source of cache keys. Every space-scoped key starts with the space id,
 * so switching spaces can never show another space's data (plan 5.1).
 */
export const queryKeys = {
  me: () => ['me'] as const,
  preferences: () => ['me', 'preferences'] as const,
  spaces: () => ['spaces'] as const,
  currencies: () => ['currencies'] as const,
  space: (spaceId: string) => ({
    /** Prefix of every key for this space: used to drop its cache on a switch. */
    all: () => ['space', spaceId] as const,
    members: () => ['space', spaceId, 'members'] as const,
    invitation: () => ['space', spaceId, 'invitation'] as const,
    manualRates: () => ['space', spaceId, 'manual-rates'] as const,
    // Wallets, transactions and the rest are added by the phase that needs them.
  }),
}
