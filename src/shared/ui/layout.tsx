import { createContext, type ReactNode, useContext } from 'react'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'

/** Side drawers instead of bottom sheets from 1024px; 2-col page grids start here too. */
export const WIDE_QUERY = '(min-width: 1024px)'

/** Desktop shell starts at 768px (plan 4.4). Read once here and passed down by context. */
export const DESKTOP_QUERY = '(min-width: 768px)'

interface LayoutValue {
  isDesktop: boolean
  /** >= 1024px */
  isWide: boolean
}

const LayoutContext = createContext<LayoutValue>({ isDesktop: false, isWide: false })

export function LayoutProvider({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const isWide = useMediaQuery(WIDE_QUERY)
  return <LayoutContext.Provider value={{ isDesktop, isWide }}>{children}</LayoutContext.Provider>
}

export function useLayout(): LayoutValue {
  return useContext(LayoutContext)
}
