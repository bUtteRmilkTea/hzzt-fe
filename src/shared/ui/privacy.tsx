import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'

/**
 * Hide-amounts state. F3 wires `hidden` to the stored preference; until then the
 * provider is local. `revealed` is the session-only eye toggle (plan F3 acceptance).
 */
interface PrivacyValue {
  /** True when amounts must be masked right now. */
  masked: boolean
  hideAmounts: boolean
  setHideAmounts: (v: boolean) => void
  revealed: boolean
  setRevealed: (v: boolean) => void
}

const PrivacyContext = createContext<PrivacyValue>({
  masked: false,
  hideAmounts: false,
  setHideAmounts: () => {},
  revealed: false,
  setRevealed: () => {},
})

export function PrivacyProvider({
  children,
  initialHidden = false,
}: {
  children: ReactNode
  initialHidden?: boolean
}) {
  const [hideAmounts, setHideAmounts] = useState(initialHidden)
  const [revealed, setRevealed] = useState(false)
  const value = useMemo(
    () => ({
      masked: hideAmounts && !revealed,
      hideAmounts,
      setHideAmounts,
      revealed,
      setRevealed,
    }),
    [hideAmounts, revealed],
  )
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacy(): PrivacyValue {
  return useContext(PrivacyContext)
}
