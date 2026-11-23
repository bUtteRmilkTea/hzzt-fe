// biome-ignore-all lint/plugin: emoji are data here (the default icon a category starts with)

/** The neutral icon used when a name is not recognised. Never a sparkle. */
export const NEUTRAL_ICON = '🏷️'

/**
 * A small static map from words in a category name to an emoji (F38-T02). Order matters: the first
 * entry whose word appears in the name wins. English and Indonesian names are covered.
 */
const WORDS: ReadonlyArray<readonly [readonly string[], string]> = [
  [['coffee', 'kopi', 'cafe'], '☕'],
  [['snack', 'camilan', 'cemilan', 'jajan'], '🍿'],
  [['food', 'meal', 'lunch', 'dinner', 'makan', 'restaurant', 'groceries', 'grocery'], '🍜'],
  [['transport', 'transportasi', 'transpor', 'fuel', 'bensin', 'taxi', 'bus', 'ojek'], '🚗'],
  [['subscription', 'langganan', 'streaming'], '🔁'],
  [['health', 'kesehatan', 'medicine', 'doctor', 'obat'], '💊'],
  [['gift', 'hadiah', 'kado'], '🎁'],
  [['salary', 'gaji', 'wage', 'pendapatan'], '💰'],
  [['freelance', 'lepas'], '💼'],
  [['dividend', 'dividen'], '🏦'],
  [['investment', 'investasi', 'stock', 'saham'], '📈'],
  [['shopping', 'belanja', 'clothes', 'pakaian'], '🛍️'],
  [['family', 'keluarga', 'kids', 'anak'], '👨‍👩‍👧'],
  [['bill', 'tagihan', 'utility', 'electric', 'listrik', 'internet'], '🧾'],
  [['rent', 'sewa', 'home', 'rumah', 'house'], '🏠'],
  [['entertainment', 'hiburan', 'movie', 'game'], '🎬'],
  [['travel', 'trip', 'liburan', 'flight'], '✈️'],
  [['education', 'pendidikan', 'school', 'course', 'sekolah'], '🎓'],
  [['refund', 'bonus'], '💵'],
]

/** The emoji a new category starts with for this name, or the neutral tag. */
export function defaultCategoryIcon(name: string): string {
  const n = name.trim().toLowerCase()
  if (!n) return NEUTRAL_ICON
  const words = n.split(/[^\p{L}]+/u).filter(Boolean)
  for (const [keys, icon] of WORDS)
    if (keys.some((k) => words.includes(k) || words.includes(`${k}s`))) return icon
  return NEUTRAL_ICON
}
