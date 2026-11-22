import { Link, type LinkProps } from '@tanstack/react-router'
import { Clock, House, Landmark, Plus, Wallet } from 'lucide-react'
import * as m from 'motion/react-m'
import type { ComponentType, ReactNode } from 'react'
import { useSpring } from '@/shared/motion'
import { cn } from './cn'
import { useLayout } from './layout'

interface NavItem {
  to: LinkProps['to']
  label: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  exact?: boolean
}

/** Four destinations. The centre "add" button is separate (plan F1-T06). */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Home', icon: House, exact: true },
  { to: '/history', label: 'History', icon: Clock },
  { to: '/wallets', label: 'Wallets', icon: Wallet },
  { to: '/assets', label: 'Assets', icon: Landmark },
]

interface AppShellProps {
  children: ReactNode
  onAdd: () => void
}

function NavLink({ item, layout }: { item: NavItem; layout: 'tab' | 'side' }) {
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact ?? false }}
      className={cn(
        'group flex items-center text-label-secondary transition-colors duration-150 [&.active]:text-label',
        layout === 'tab'
          ? 'min-h-12 min-w-12 flex-1 flex-col justify-center gap-0.5 text-xs font-medium'
          : 'min-h-11 gap-3 rounded-md px-3 text-base font-medium hover:bg-surface-3 [&.active]:bg-surface-3',
      )}
    >
      <Icon aria-hidden className="size-6 group-[.active]:text-accent" />
      <span>{item.label}</span>
    </Link>
  )
}

function AddButton({ onAdd, layout }: { onAdd: () => void; layout: 'tab' | 'side' }) {
  const press = useSpring('press')
  return (
    <m.button
      type="button"
      onClick={onAdd}
      aria-label="Add transaction"
      whileTap={{ scale: 0.92 }}
      transition={press}
      className={cn(
        'flex items-center justify-center bg-accent text-accent-label shadow-card',
        layout === 'tab'
          ? 'mx-1 size-14 shrink-0 rounded-full'
          : 'min-h-11 w-full gap-2 rounded-full font-semibold',
      )}
    >
      <Plus aria-hidden className="size-6" />
      {layout === 'side' ? <span>Add</span> : null}
    </m.button>
  )
}

/** One shell, chosen by a single media query (read once in LayoutProvider). */
export function AppShell({ children, onAdd }: AppShellProps) {
  const { isDesktop } = useLayout()

  if (isDesktop) {
    return (
      <div className="min-h-dvh">
        <aside className="fixed inset-y-0 left-0 flex w-60 flex-col gap-2 border-r border-border bg-surface-1 p-4">
          <p className="px-3 pt-2 pb-4 text-lg font-semibold">HZZT</p>
          <nav aria-label="Primary" className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.label} item={item} layout="side" />
            ))}
          </nav>
          <div className="mt-4">
            <AddButton onAdd={onAdd} layout="side" />
          </div>
        </aside>
        <main className="ml-60 min-h-dvh p-8">{children}</main>
      </div>
    )
  }

  const [home, history, wallets, assets] = NAV_ITEMS as [NavItem, NavItem, NavItem, NavItem]
  return (
    <div className="min-h-dvh">
      <main className="px-4 pt-6 pb-32">{children}</main>
      <nav
        aria-label="Primary"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
        className="fixed inset-x-4 z-40 mx-auto flex max-w-md items-center rounded-full border border-border bg-surface-2 px-2 py-1.5 shadow-sheet supports-[backdrop-filter]:bg-chrome supports-[backdrop-filter]:backdrop-blur-[20px]"
      >
        <NavLink item={home} layout="tab" />
        <NavLink item={history} layout="tab" />
        <AddButton onAdd={onAdd} layout="tab" />
        <NavLink item={wallets} layout="tab" />
        <NavLink item={assets} layout="tab" />
      </nav>
    </div>
  )
}
