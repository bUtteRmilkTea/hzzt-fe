// biome-ignore-all lint/plugin: dictionary strings are the subject of these tests
import { defaultCategoryIcon, NEUTRAL_ICON } from '../ui/categoryIcons'
import {
  CATEGORY_KEYS,
  categoryLabel,
  categoryNameLabel,
  DICTIONARY,
  readLanguage,
  systemText,
  TX_KEYS,
  writeLanguage,
} from './index'

describe('systemText (F38-T01)', () => {
  it('uses the dictionary for each system key, in each language', () => {
    for (const k of TX_KEYS) {
      expect(systemText({ systemKey: k, title: 'x' }, 'en')).toBe(DICTIONARY.en.tx[k])
      expect(systemText({ systemKey: k, title: 'x' }, 'id')).toBe(DICTIONARY.id.tx[k])
    }
    expect(systemText({ systemKey: 'BALANCE_TOP_UP' }, 'id')).toBe('Isi saldo')
  })
  it('falls back to the server title for a user entry or an unknown key', () => {
    expect(systemText({ title: 'Lunch' }, 'id')).toBe('Lunch')
    expect(systemText({ systemKey: 'SOMETHING_NEW', title: 'Kept' }, 'id')).toBe('Kept')
    expect(systemText({}, 'id')).toBeUndefined()
  })
})

describe('category labels', () => {
  it('localises a default category by its key, but never a renamed one', () => {
    expect(categoryLabel({ systemKey: 'SALARY', name: 'Salary' }, 'id')).toBe('Gaji')
    expect(categoryLabel({ systemKey: 'SALARY', name: 'Pay cheque' }, 'id')).toBe('Pay cheque')
    expect(categoryLabel({ name: 'Salary' }, 'id')).toBe('Salary') // a user's own category
  })
  it('matches a bare English default name', () => {
    expect(categoryNameLabel('Snacks', 'id')).toBe('Camilan')
    expect(categoryNameLabel('Pets', 'id')).toBe('Pets')
    expect(categoryNameLabel(undefined, 'id')).toBe('')
  })
  it('the two languages have every key and no empty text', () => {
    for (const lang of ['en', 'id'] as const)
      for (const k of CATEGORY_KEYS) expect(DICTIONARY[lang].category[k].length).toBeGreaterThan(0)
  })
  it('keeps the choice on this device', () => {
    writeLanguage('id')
    expect(readLanguage()).toBe('id')
    writeLanguage('en')
    expect(readLanguage()).toBe('en')
  })
})

describe('default category icons (F38-T02)', () => {
  it('Subscriptions and Snacks differ, and every default seed is distinct', () => {
    expect(defaultCategoryIcon('Subscriptions')).not.toBe(defaultCategoryIcon('Snacks'))
    const icons = CATEGORY_KEYS.map((k) => defaultCategoryIcon(DICTIONARY.en.category[k]))
    expect(new Set(icons).size).toBe(icons.length)
  })
  it('understands Indonesian names and never falls back to a sparkle', () => {
    expect(defaultCategoryIcon('Langganan')).toBe(defaultCategoryIcon('Subscriptions'))
    expect(defaultCategoryIcon('Gaji')).toBe(defaultCategoryIcon('Salary'))
    for (const n of ['', 'Zzz', '12345', 'Misc']) {
      expect(defaultCategoryIcon(n)).toBe(NEUTRAL_ICON)
      expect(defaultCategoryIcon(n)).not.toBe('✨')
    }
  })
})
