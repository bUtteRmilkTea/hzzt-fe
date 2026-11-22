import { Decimal } from './decimal'

export type CalcKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | '+'
  | '-'
  | '*'
  | '/'
  | '='
  | 'back'
  | 'clear'

const OPS = new Set(['+', '-', '*', '/'])
const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

/** Display glyphs for the operators. */
export const OP_GLYPH: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

type Token = { t: 'num'; v: Decimal } | { t: 'op'; v: string }

function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = []
  let num = ''
  for (const ch of expr) {
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      num += ch
    } else if (OPS.has(ch)) {
      if (num === '' && ch === '-' && (tokens.length === 0 || tokens.at(-1)?.t === 'op')) {
        num = '-' // unary minus
        continue
      }
      if (num === '' || num === '-' || num === '.') return null
      tokens.push({ t: 'num', v: new Decimal(num) })
      num = ''
      tokens.push({ t: 'op', v: ch })
    } else {
      return null
    }
  }
  if (num !== '') {
    if (num === '-' || num === '.') return null
    tokens.push({ t: 'num', v: new Decimal(num) })
  }
  return tokens
}

/**
 * Evaluate an arithmetic expression exactly with decimal.js-light.
 * Returns a plain decimal string (no exponent), or null if the expression is
 * incomplete, malformed, or divides by zero.
 */
export function evaluate(expr: string): string | null {
  const tokens = tokenize(expr)
  if (!tokens || tokens.length === 0 || tokens.at(-1)?.t === 'op') return null

  // Shunting-yard to postfix.
  const out: Token[] = []
  const stack: string[] = []
  for (const tok of tokens) {
    if (tok.t === 'num') {
      out.push(tok)
      continue
    }
    while (stack.length > 0 && (PREC[stack.at(-1) as string] ?? 0) >= (PREC[tok.v] ?? 0)) {
      out.push({ t: 'op', v: stack.pop() as string })
    }
    stack.push(tok.v)
  }
  while (stack.length > 0) out.push({ t: 'op', v: stack.pop() as string })

  const values: Decimal[] = []
  for (const tok of out) {
    if (tok.t === 'num') {
      values.push(tok.v)
      continue
    }
    const b = values.pop()
    const a = values.pop()
    if (!a || !b) return null
    switch (tok.v) {
      case '+':
        values.push(a.plus(b))
        break
      case '-':
        values.push(a.minus(b))
        break
      case '*':
        values.push(a.times(b))
        break
      case '/':
        if (b.isZero()) return null
        values.push(a.div(b))
        break
    }
  }
  const result = values[0]
  if (!result || values.length !== 1) return null
  return result.toFixed()
}

/** Apply one keypad press to the expression buffer. */
export function applyKey(buffer: string, key: CalcKey): string {
  if (key === 'clear') return ''
  if (key === 'back') return buffer.slice(0, -1)
  if (key === '=') return evaluate(buffer) ?? buffer

  const last = buffer.at(-1)
  if (OPS.has(key)) {
    if (buffer === '') return key === '-' ? '-' : ''
    if (last !== undefined && OPS.has(last)) return buffer.slice(0, -1) + key // replace operator
    if (buffer === '-') return buffer
    return buffer + key
  }
  if (key === '.') {
    const currentNumber = buffer.split(/[+\-*/]/).at(-1) ?? ''
    return currentNumber.includes('.') ? buffer : buffer + (currentNumber === '' ? '0.' : '.')
  }
  return buffer + key
}
