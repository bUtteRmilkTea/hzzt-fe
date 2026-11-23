import { useState } from 'react'
import { cn } from './cn'
import { Input } from './Input'
import { HEX_COLOR, PALETTE } from './palette'

interface ColorPickerProps {
  value: string
  onChange: (hex: string) => void
  label?: string
}

/** Palette swatches plus a custom `#RRGGBB` field. */
export function ColorPicker({ value, onChange, label = 'Colour' }: ColorPickerProps) {
  const [custom, setCustom] = useState(PALETTE.some((c) => c === value) ? '' : value)
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-label-secondary">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={`Colour ${hex}`}
            aria-pressed={value.toLowerCase() === hex.toLowerCase()}
            onClick={() => {
              setCustom('')
              onChange(hex)
            }}
            style={{ backgroundColor: hex }}
            className={cn(
              'size-12 rounded-full border-2 border-transparent',
              value.toLowerCase() === hex.toLowerCase() &&
                'ring-2 ring-label ring-offset-2 ring-offset-surface-2',
            )}
          />
        ))}
      </div>
      <Input
        aria-label="Custom hex colour"
        placeholder="#RRGGBB"
        value={custom}
        maxLength={7}
        invalid={custom !== '' && !HEX_COLOR.test(custom)}
        onChange={(e) => {
          const v = e.target.value
          setCustom(v)
          if (HEX_COLOR.test(v)) onChange(v)
        }}
      />
    </fieldset>
  )
}
