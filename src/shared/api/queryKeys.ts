/**
 * The single source of cache keys. Every space-scoped key starts with the space id,
 * so switching spaces can never show another space's data (plan 5.1).
 */
export const queryKeys = {
  me: () => ['me'] as const,
  space: (spaceId: string) => ({
    all: () => ['space', spaceId] as const,
    // Resource factories are added by the phase that needs them, e.g.:
    // wallets: (filters?: unknown) => ['space', spaceId, 'wallets', filters] as const,
  }),
}
