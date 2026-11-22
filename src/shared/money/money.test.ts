import {
  applyKey,
  displayDigits,
  evaluate,
  format,
  minorUnits,
  parseInput,
  signOf,
  toDecimal,
} from './index'

describe('minorUnits', () => {
  it('knows IDR 0, USD 2, JPY 0, KWD 3', () => {
    expect(minorUnits('IDR')).toBe(0)
    expect(minorUnits('USD')).toBe(2)
    expect(minorUnits('JPY')).toBe(0)
    expect(minorUnits('KWD')).toBe(3)
  })
  it('falls back to 2 for an unknown code', () => {
    expect(minorUnits('???')).toBe(2)
  })
})

describe('format', () => {
  it('formats IDR with no decimals and USD with two', () => {
    expect(format('1500000', 'IDR')).toMatch(/1,500,000$/)
    expect(format('1234.5', 'USD')).toBe('$1,234.50')
  })
  it('rounds 1.005 half-up at 2 minor units, exactly', () => {
    expect(format('1.005', 'USD')).toBe('$1.01')
    expect(format('1.004', 'USD')).toBe('$1.00')
  })
  it('keeps precision beyond double range', () => {
    expect(format('12345678901234567.89', 'USD')).toBe('$12,345,678,901,234,567.89')
  })
  it('supports sign display and no symbol', () => {
    expect(format('5', 'USD', { signDisplay: 'always' })).toBe('+$5.00')
    expect(format('-5', 'USD')).toBe('-$5.00')
    expect(format('1234.5', 'USD', { withoutSymbol: true })).toBe('1,234.50')
  })
})

describe('parseInput', () => {
  it('normalises to the currency minor units', () => {
    expect(parseInput('1,234.5', 'USD')).toBe('1234.50')
    expect(parseInput('1.005', 'USD')).toBe('1.01')
    expect(parseInput('1500.7', 'IDR')).toBe('1501')
    expect(parseInput('.5', 'USD')).toBe('0.50')
  })
  it('rejects junk', () => {
    expect(parseInput('', 'USD')).toBeNull()
    expect(parseInput('abc', 'USD')).toBeNull()
    expect(parseInput('1.2.3', 'USD')).toBeNull()
    expect(parseInput('.', 'USD')).toBeNull()
  })
})

describe('signOf / toDecimal', () => {
  it('reports sign', () => {
    expect(signOf('-0.01')).toBe(-1)
    expect(signOf('0.00')).toBe(0)
    expect(signOf('3')).toBe(1)
  })
  it('passes a Decimal through unchanged', () => {
    const d = toDecimal('1.5')
    expect(toDecimal(d)).toBe(d)
  })
})

describe('evaluate (calculator)', () => {
  it('0.1 + 0.2 is exactly 0.3', () => {
    expect(evaluate('0.1+0.2')).toBe('0.3')
  })
  it('respects operator precedence', () => {
    expect(evaluate('2+3*4')).toBe('14')
    expect(evaluate('10-4/2')).toBe('8')
  })
  it('handles unary minus and decimals', () => {
    expect(evaluate('-5+2')).toBe('-3')
    expect(evaluate('1.5*2')).toBe('3')
  })
  it('returns null for incomplete, malformed or divide-by-zero input', () => {
    expect(evaluate('')).toBeNull()
    expect(evaluate('5+')).toBeNull()
    expect(evaluate('5/0')).toBeNull()
    expect(evaluate('5**2')).toBeNull()
    expect(evaluate('abc')).toBeNull()
  })
  it('never yields exponent notation', () => {
    expect(evaluate('1/3')).not.toMatch(/e/i)
    expect(evaluate('0.0000001*1')).toBe('0.0000001')
  })
})

describe('applyKey', () => {
  const press = (keys: Parameters<typeof applyKey>[1][]) =>
    keys.reduce((buf, k) => applyKey(buf, k), '')
  it('builds an expression and evaluates on =', () => {
    expect(press(['0', '.', '1', '+', '0', '.', '2', '='])).toBe('0.3')
  })
  it('replaces a trailing operator instead of stacking', () => {
    expect(press(['5', '+', '*', '2'])).toBe('5*2')
  })
  it('refuses a second decimal point in one number', () => {
    expect(press(['1', '.', '2', '.', '3'])).toBe('1.23')
  })
  it('starts a number with 0. when . is pressed first', () => {
    expect(press(['.', '5'])).toBe('0.5')
  })
  it('supports backspace and clear', () => {
    expect(press(['1', '2', 'back'])).toBe('1')
    expect(press(['1', '2', 'clear'])).toBe('')
  })
  it('keeps the buffer when = cannot evaluate', () => {
    expect(press(['5', '/', '0', '='])).toBe('5/0')
  })
})

describe('display digits (S0)', () => {
  it('IDR and JPY show 0 decimals, USD/EUR 2, KWD capped at 2', () => {
    expect(displayDigits('IDR')).toBe(0)
    expect(displayDigits('jpy')).toBe(0)
    expect(displayDigits('USD')).toBe(2)
    expect(displayDigits('EUR')).toBe(2)
    expect(displayDigits('KWD')).toBe(2)
    expect(format('1.2345', 'KWD')).toBe('KWD\u00a01.23')
    expect(format('1234.5', 'JPY')).toMatch(/1,235$/)
    expect(format('1500000.6', 'IDR')).toMatch(/1,500,001$/)
  })
  it('caps compact at 2 fraction digits', () => {
    expect(format('1234567', 'USD', { compact: true })).toBe('$1.23M')
  })
  it('handles negative and large values', () => {
    expect(format('-1234.567', 'EUR')).toBe('-€1,234.57')
    expect(format('987654321098.76', 'USD')).toBe('$987,654,321,098.76')
  })
  it('parseInput uses the display digit rule', () => {
    expect(parseInput('1.2345', 'KWD')).toBe('1.23')
    expect(parseInput('10.5', 'JPY')).toBe('11')
  })
})
