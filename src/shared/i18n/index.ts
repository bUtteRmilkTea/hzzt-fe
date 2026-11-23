import { useSyncExternalStore } from 'react'

/** A small typed dictionary for the strings the server sends in English (D-F51). User data is never translated. */
export type Language = 'en' | 'id'
export const LANGUAGES: ReadonlyArray<{ value: Language; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' },
]

/** The stable keys of the default categories (`systemKey` on a category). */
export const CATEGORY_KEYS = [
  'TRANSPORT',
  'SHOPPING',
  'SUBSCRIPTIONS',
  'HEALTH',
  'GIFTS',
  'SNACKS',
  'FAMILY',
  'SALARY',
  'FREELANCE',
  'INVESTMENT',
  'DIVIDEND',
] as const
/** `systemKey` on a transaction the backend wrote itself. */
export const TX_KEYS = ['OPENING_BALANCE', 'BALANCE_TOP_UP', 'BALANCE_ADJUSTMENT'] as const

export type CategoryKey = (typeof CATEGORY_KEYS)[number]
export type TxKey = (typeof TX_KEYS)[number]

type Dictionary = {
  category: Record<CategoryKey, string>
  tx: Record<TxKey, string>
}

export const DICTIONARY: Record<Language, Dictionary> = {
  en: {
    category: {
      TRANSPORT: 'Transport',
      SHOPPING: 'Shopping',
      SUBSCRIPTIONS: 'Subscriptions',
      HEALTH: 'Health',
      GIFTS: 'Gifts',
      SNACKS: 'Snacks',
      FAMILY: 'Family',
      SALARY: 'Salary',
      FREELANCE: 'Freelance',
      INVESTMENT: 'Investment',
      DIVIDEND: 'Dividend',
    },
    tx: {
      OPENING_BALANCE: 'Opening balance',
      BALANCE_TOP_UP: 'Balance top up',
      BALANCE_ADJUSTMENT: 'Balance adjustment',
    },
  },
  id: {
    category: {
      TRANSPORT: 'Transportasi',
      SHOPPING: 'Belanja',
      SUBSCRIPTIONS: 'Langganan',
      HEALTH: 'Kesehatan',
      GIFTS: 'Hadiah',
      SNACKS: 'Camilan',
      FAMILY: 'Keluarga',
      SALARY: 'Gaji',
      FREELANCE: 'Pekerjaan lepas',
      INVESTMENT: 'Investasi',
      DIVIDEND: 'Dividen',
    },
    tx: {
      OPENING_BALANCE: 'Saldo awal',
      BALANCE_TOP_UP: 'Isi saldo',
      BALANCE_ADJUSTMENT: 'Penyesuaian saldo',
    },
  },
}

const STORAGE_KEY = 'hzzt.language'
const EVENT = 'hzzt:language'

export function readLanguage(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'id' ? 'id' : 'en'
  } catch {
    return 'en'
  }
}

/** Stored on this device only. */
export function writeLanguage(lang: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Private mode: the choice lasts until reload.
  }
  memory = lang
  window.dispatchEvent(new Event(EVENT))
}

let memory: Language | null = null
const current = (): Language => memory ?? readLanguage()

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** The current language; components re-render when it changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, current, () => 'en')
}

const isCategoryKey = (k: string | undefined): k is CategoryKey =>
  Boolean(k) && (CATEGORY_KEYS as readonly string[]).includes(k as string)
const isTxKey = (k: string | undefined): k is TxKey =>
  Boolean(k) && (TX_KEYS as readonly string[]).includes(k as string)

/**
 * The title of a transaction: the dictionary text for a system row (`systemKey`), else the title the
 * server sent. A user's own title is never replaced.
 */
export function systemText(
  tx: { systemKey?: string | undefined; title?: string | undefined },
  lang: Language = current(),
): string | undefined {
  return isTxKey(tx.systemKey) ? DICTIONARY[lang].tx[tx.systemKey] : tx.title
}

/**
 * The name of a category. A default category (`systemKey`) shows in the chosen language unless the
 * user renamed it: a renamed one still carries its key, so the name must equal the English default.
 */
export function categoryLabel(
  c: { systemKey?: string | undefined; name?: string | undefined },
  lang: Language = current(),
): string {
  const name = c.name ?? ''
  if (!isCategoryKey(c.systemKey)) return name
  return name === DICTIONARY.en.category[c.systemKey]
    ? DICTIONARY[lang].category[c.systemKey]
    : name
}

/** A category name sent without its key (a reference on a transaction): match the English default. */
export function categoryNameLabel(name: string | undefined, lang: Language = current()): string {
  if (!name) return ''
  const key = CATEGORY_KEYS.find((k) => DICTIONARY.en.category[k] === name)
  return key ? DICTIONARY[lang].category[key] : name
}
