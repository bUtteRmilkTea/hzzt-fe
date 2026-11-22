import { Eye, EyeOff } from 'lucide-react'
import { usePreferences } from '@/app/providers/PreferencesProvider'
import { usePrivacy } from '@/shared/ui/privacy'

/**
 * The eye toggle. Only shown when hide-amounts is on. Revealing lasts for this
 * session only: it never changes the stored preference.
 */
export function RevealAmountsButton() {
  const {
    preferences: { hideAmounts },
  } = usePreferences()
  const { revealed, setRevealed } = usePrivacy()
  if (!hideAmounts) return null
  return (
    <button
      type="button"
      aria-label={revealed ? 'Hide amounts' : 'Show amounts'}
      aria-pressed={revealed}
      onClick={() => setRevealed(!revealed)}
      className="inline-flex size-11 items-center justify-center rounded-full text-label-secondary hover:bg-surface-3"
    >
      {revealed ? (
        <Eye aria-hidden className="size-5" />
      ) : (
        <EyeOff aria-hidden className="size-5" />
      )}
    </button>
  )
}
