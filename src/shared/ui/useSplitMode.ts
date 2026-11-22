import { useState } from 'react'
import type { SplitMode } from './SplitSwitch'

/**
 * The pie split mode, kept for the browser session only (never any data). Storage can throw
 * (private windows, blocked site data), so every access is guarded and the default still works.
 */
export function useSplitMode(storageKey: string): [SplitMode, (m: SplitMode) => void] {
  const [mode, setMode] = useState<SplitMode>(() => {
    try {
      const v = sessionStorage.getItem(storageKey)
      return v === 'asset' ? 'asset' : 'class'
    } catch {
      return 'class'
    }
  })
  const set = (m: SplitMode) => {
    setMode(m)
    try {
      sessionStorage.setItem(storageKey, m)
    } catch {
      // The choice just isn't remembered.
    }
  }
  return [mode, set]
}
