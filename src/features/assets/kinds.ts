export type AssetKind = 'FIXED_ASSET' | 'RECEIVABLE' | 'LIABILITY'

export interface KindMeta {
  kind: AssetKind
  /** Section heading on the asset page. */
  section: string
  /** Singular noun for forms and buttons. */
  noun: string
  addLabel: string
  emptyText: string
  defaultIcon: string
  /** Money moves back through a settlement. */
  settles: boolean
  settleLabel: string
}

export const KINDS: readonly KindMeta[] = [
  {
    kind: 'FIXED_ASSET',
    section: 'Fixed assets',
    noun: 'fixed asset',
    addLabel: 'Add fixed asset',
    emptyText: 'Property, vehicles and other things you own.',
    defaultIcon: '🏠',
    settles: false,
    settleLabel: '',
  },
  {
    kind: 'RECEIVABLE',
    section: 'Money owed to you',
    noun: 'receivable',
    addLabel: 'Add money owed',
    emptyText: 'Money other people owe you.',
    defaultIcon: '🤝',
    settles: true,
    settleLabel: 'Receive payment',
  },
  {
    kind: 'LIABILITY',
    section: 'Debt',
    noun: 'debt',
    addLabel: 'Add debt',
    emptyText: 'Loans and other money you owe.',
    defaultIcon: '💳',
    settles: true,
    settleLabel: 'Pay down',
  },
]

export const kindMeta = (kind: string | undefined): KindMeta =>
  KINDS.find((k) => k.kind === kind) ?? (KINDS[0] as KindMeta)
