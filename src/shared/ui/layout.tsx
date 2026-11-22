import { createContext, type ReactNode, useContext } from 'react'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'

/** Desktop shell starts at 768px (plan 4.4). Read once here and passed down by context. */
export const DESKTOP_QUERY = '(min-width: 768px)'

interface LayoutValue {
  isDesktop: boolean
}

const LayoutContext = createContext<LayoutValue>({ isDesktop: false })

export function LayoutProvider({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  return <LayoutContext.Provider value={{ isDesktop }}>{children}</LayoutContext.Provider>
}

export function useLayout(): LayoutValue {
  return useContext(LayoutContext)
}
