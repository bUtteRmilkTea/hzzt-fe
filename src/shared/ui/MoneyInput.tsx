import { Delete } from 'lucide-react'
import { useState } from 'react'
import { applyKey, type CalcKey, evaluate, OP_GLYPH, parseInput } from '@/shared/money'
import { cn } from './cn'
import { Input } from './Input'
import { useKeyboardMode } from './privacy'

interface MoneyInputProps {
  /** Current value as an API money string ('' when empty). */
  value: string
  onChange: (value: string) => void
  currency: string
  /** 'calculator' shows the mini-calculator keypad; 'numeric' is a plain decimal field. */
  mode?: 'calculator' | 'numeric'
  id?: string
  invalid?: boolean
  'aria-describedby'?: string
}

const KEYS: { key: CalcKey; label: string; aria: string; kind: 'num' | 'op' | 'fn' | 'eq' }[] = [
  { key: 'clear', label: 'C', aria: 'Clear', kind: 'fn' },
  { key: 'back', label: '', aria: 'Backspace', kind: 'fn' },
  { key: '/', label: OP_GLYPH['/'] as string, aria: 'Divide', kind: 'op' },
  { key: '*', label: OP_GLYPH['*'] as string, aria: 'Multiply', kind: 'op' },
  { key: '7', label: '7', aria: '7', kind: 'num' },
  { key: '8', label: '8', aria: '8', kind: 'num' },
  { key: '9', label: '9', aria: '9', kind: 'num' },
  { key: '-', label: OP_GLYPH['-'] as string, aria: 'Minus', kind: 'op' },
  { key: '4', label: '4', aria: '4', kind: 'num' },
  { key: '5', label: '5', aria: '5', kind: 'num' },
  { key: '6', label: '6', aria: '6', kind: 'num' },
  { key: '+', label: '+', aria: 'Plus', kind: 'op' },
  { key: '1', label: '1', aria: '1', kind: 'num' },
  { key: '2', label: '2', aria: '2', kind: 'num' },
  { key: '3', label: '3', aria: '3', kind: 'num' },
  { key: '=', label: '=', aria: 'Equals', kind: 'eq' },
  { key: '0', label: '0', aria: '0', kind: 'num' },
  { key: '.', label: '.', aria: 'Decimal point', kind: 'num' },
]

function display(expr: string): string {
  return [...expr].map((c) => OP_GLYPH[c] ?? c).join('')
}

/** Evaluate the expression ignoring a dangling trailing operator. */
function liveValue(expr: string): string {
  return evaluate(expr.replace(/[+\-*/]+$/, '')) ?? ''
}

function CalculatorInput({ value, onChange, currency, id, invalid, ...rest }: MoneyInputProps) {
  const [expr, setExpr] = useState(value)

  const press = (key: CalcKey) => {
    const next = applyKey(expr, key)
    setExpr(next)
    onChange(liveValue(next))
  }

  const hasOperator = /[+\-*/]/.test(expr.slice(1))
  const preview = hasOperator ? liveValue(expr) : ''

  return (
    <div className="flex flex-col gap-3">
      <output
        id={id}
        aria-live="polite"
        aria-invalid={invalid || undefined}
        aria-describedby={rest['aria-describedby']}
        className={cn(
          'tabular flex min-h-20 flex-col items-end justify-end rounded-md border border-border bg-surface-2 px-4 py-3',
          invalid && 'border-negative',
        )}
      >
        <span className="text-sm text-label-tertiary">{currency}</span>
        <span className="text-2xl font-medium">{display(expr) || '0'}</span>
        {preview ? <span className="text-sm text-label-secondary">= {preview}</span> : null}
      </output>
      <div className="grid grid-cols-4 gap-2">
        {KEYS.map((k) => (
          <button
            key={k.key}
            type="button"
            aria-label={k.aria}
            onClick={() => press(k.key)}
            className={cn(
              'flex min-h-12 items-center justify-center rounded-md text-lg font-medium transition-transform duration-100 active:scale-95',
              k.kind === 'num' && 'bg-surface-3 text-label',
              k.kind === 'fn' && 'bg-surface-3 text-label-secondary',
              k.kind === 'op' && 'bg-surface-3 text-accent',
              k.kind === 'eq' && 'row-span-2 bg-accent text-accent-label',
              k.key === '0' && 'col-span-2',
            )}
          >
            {k.key === 'back' ? <Delete aria-hidden className="size-5" /> : k.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function NumericInput({ value, onChange, currency, id, invalid, ...rest }: MoneyInputProps) {
  const [text, setText] = useState(value)
  return (
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      placeholder="0"
      invalid={invalid}
      aria-describedby={rest['aria-describedby']}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseInput(e.target.value, currency) ?? '')
      }}
      onBlur={() => {
        const normalised = parseInput(text, currency)
        if (normalised !== null) setText(normalised)
      }}
      className="tabular text-right"
    />
  )
}

export function MoneyInput({ mode, ...props }: MoneyInputProps) {
  const preferred = useKeyboardMode()
  return (mode ?? preferred) === 'calculator' ? (
    <CalculatorInput {...props} />
  ) : (
    <NumericInput {...props} />
  )
}
