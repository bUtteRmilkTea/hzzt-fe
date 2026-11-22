import { arrayMove } from '@dnd-kit/sortable'
import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage } from '@/shared/api/errors'
import { PieChart } from '@/shared/charts'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { cn } from '@/shared/ui/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useLayout } from '@/shared/ui/layout'
import { Page } from '@/shared/ui/Page'
import { PageGrid, Panel } from '@/shared/ui/PageGrid'
import { Skeleton } from '@/shared/ui/Skeleton'
import { SortableItem, SortableList } from '@/shared/ui/SortableList'
import { STAGGER, staggerStyle } from '@/shared/ui/stagger'
import { useToast } from '@/shared/ui/Toast'
import { WalletCard } from '@/shared/ui/WalletCard'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { CreateWalletSheet } from './CreateWalletSheet'
import { prefsOf } from './display'
import { moveItem, useReorderWallets, useWallets, type WalletDTO } from './hooks'
import { walletPieSlices } from './pie'
import { WalletStack } from './WalletStack'

function TotalCard({ value, currency }: { value: string; currency: string }) {
  return (
    <Card>
      <p className="text-sm text-label-secondary">Total balance</p>
      <p className="text-3xl font-medium lg:text-4xl" data-testid="wallets-total">
        <Amount animate value={value} currency={currency} />
      </p>
    </Card>
  )
}

/**
 * A sortable list of wallet cards: from 1024px a grid, below it the single column shown while
 * reordering. The whole card drags (no handle); the card itself is still a link.
 */
function WalletGrid({
  wallets,
  spaceId,
  renderAside,
  onReorder,
  layout,
}: {
  wallets: readonly WalletDTO[]
  spaceId: string
  renderAside: (w: WalletDTO, i: number) => React.ReactNode
  onReorder: (from: number, to: number) => void
  layout: 'grid' | 'list'
}) {
  // Keep the dropped order locally and apply it in the same render as the drop. The server list
  // only updates a tick later (the mutation awaits before its optimistic write), and until then
  // the cards would spring back to their old places and then jump. When the list changes, for
  // example after a failed save is rolled back, the server order wins again.
  const [order, setOrder] = useState<string[]>(() => wallets.map((w) => w.id as string))
  useEffect(() => setOrder(wallets.map((w) => w.id as string)), [wallets])
  const byId = new Map(wallets.map((w) => [w.id as string, w]))
  const ordered = order.flatMap((id) => byId.get(id) ?? [])
  const shown = ordered.length === wallets.length ? ordered : wallets
  const reorder = (from: number, to: number) => {
    setOrder((o) => arrayMove(o, from, to))
    onReorder(from, to)
  }
  const card = (w: WalletDTO) => (
    <WalletCard
      name={w.name ?? ''}
      icon={w.icon ?? '💳'}
      balance={w.balance ?? '0'}
      currency={w.currency ?? ''}
      type={w.type ?? 'OTHER'}
      cardStyle={w.cardStyle}
      isFavorite={w.isFavorite}
      display={prefsOf(w)}
    />
  )
  return (
    <SortableList
      ids={shown.map((w) => w.id as string)}
      onReorder={reorder}
      layout={layout}
      renderOverlay={(id) => {
        const w = shown.find((x) => x.id === id)
        return w ? card(w) : null
      }}
      className={cn(
        'grid grid-cols-1 gap-4',
        layout === 'grid' && 'sm:grid-cols-2 lg:gap-6 2xl:grid-cols-3',
      )}
    >
      {shown.map((w, i) => (
        <SortableItem
          key={w.id}
          id={w.id as string}
          data-testid="wallet-grid-item"
          className={cn('flex min-w-0 flex-col gap-2', STAGGER)}
          style={staggerStyle(i)}
        >
          <Link
            to="/s/$spaceId/wallets/$id"
            params={{ spaceId, id: w.id as string }}
            aria-label={`${w.name}, open wallet`}
            draggable={false}
            className="card-interactive block rounded-lg [-webkit-user-drag:none]"
          >
            {card(w)}
          </Link>
          {renderAside(w, i)}
        </SortableItem>
      ))}
    </SortableList>
  )
}

export function WalletsScreen() {
  const { space } = useSpace()
  const { isWide } = useLayout()
  const wallets = useWallets(space.id)
  const reorder = useReorderWallets(space.id)
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const pieSlices = walletPieSlices(wallets.data, space.baseCurrency)

  const move = (index: number, to: number) => {
    const items = wallets.data?.items ?? []
    const ids = moveItem(items, index, to).map((w) => w.id as string)
    reorder.mutate(ids, { onError: (err) => toast.show(errorMessage(err), 'error') })
  }

  const moveButtons = (w: WalletDTO, i: number) => (
    <div className="flex gap-1">
      <Button
        variant="secondary"
        size="icon"
        aria-label={`Move ${w.name} up`}
        disabled={i === 0}
        onClick={() => move(i, i - 1)}
      >
        <ArrowUp aria-hidden className="size-5" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        aria-label={`Move ${w.name} down`}
        disabled={i === (wallets.data?.items.length ?? 0) - 1}
        onClick={() => move(i, i + 1)}
      >
        <ArrowDown aria-hidden className="size-5" />
      </Button>
    </div>
  )

  // Reorder mode (below 1024px): the buttons are always shown. From 1024px the grid is always
  // draggable, and the buttons stay for keyboard users: visible only while one has focus.
  const renderAside = (w: WalletDTO, i: number) => (reordering ? moveButtons(w, i) : null)
  const renderGridAside = (w: WalletDTO, i: number) => (
    <div className="sr-only focus-within:not-sr-only">{moveButtons(w, i)}</div>
  )

  return (
    <Page>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-medium">Wallets</h1>
        <div className="flex gap-2">
          {!isWide && wallets.data && wallets.data.items.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setReordering((r) => !r)}>
              {reordering ? 'Done' : 'Reorder'}
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="size-4" />
            Add wallet
          </Button>
        </div>
      </div>

      {wallets.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-20" />
          <Skeleton className="aspect-[1.7/1] w-full" />
          <Skeleton className="aspect-[1.7/1] w-full" />
        </div>
      ) : wallets.isError ? (
        <EmptyState
          title="Couldn't load your wallets"
          description="Check your connection and try again."
          action={<Button onClick={() => void wallets.refetch()}>Try again</Button>}
        />
      ) : wallets.data.items.length === 0 ? (
        <>
          <TotalCard
            value={wallets.data.total.amount}
            currency={wallets.data.total.currency || space.baseCurrency}
          />
          <WarningsStrip warnings={wallets.data.total.warnings} />
          <EmptyState
            title="No wallets yet"
            description="Add a bank account, e-wallet or cash to start tracking."
            action={<Button onClick={() => setCreating(true)}>Add wallet</Button>}
          />
        </>
      ) : (
        <PageGrid>
          {/* Mobile order is total, wallets, share. From lg the total and share form a sticky right rail. */}
          <div className="min-w-0 lg:col-start-9 lg:col-span-4 lg:row-start-1 lg:self-start">
            <TotalCard
              value={wallets.data.total.amount}
              currency={wallets.data.total.currency || space.baseCurrency}
            />
            <WarningsStrip warnings={wallets.data.total.warnings} />
          </div>
          <div className="min-w-0 lg:col-span-8 lg:row-span-2 lg:row-start-1">
            {isWide ? (
              <WalletGrid
                layout="grid"
                wallets={wallets.data.items}
                spaceId={space.id}
                renderAside={renderGridAside}
                onReorder={move}
              />
            ) : reordering ? (
              <WalletGrid
                layout="list"
                wallets={wallets.data.items}
                spaceId={space.id}
                renderAside={renderAside}
                onReorder={move}
              />
            ) : (
              <WalletStack
                wallets={wallets.data.items}
                spaceId={space.id}
                expanded={expanded}
                onExpandedChange={setExpanded}
                forceExpanded={reordering}
                renderAside={renderAside}
              />
            )}
          </div>
          <Panel
            span={4}
            aria-label="Balance share"
            className="lg:col-start-9 lg:row-start-2 lg:self-start"
          >
            <h2 className="mb-3 text-base font-semibold">Share of balance</h2>
            <PieChart
              donut
              draw
              slices={pieSlices}
              currency={wallets.data.total.currency || space.baseCurrency}
              label="Share of total balance per wallet"
              showAmounts={false}
            />
          </Panel>
        </PageGrid>
      )}

      {creating ? <CreateWalletSheet onClose={() => setCreating(false)} /> : null}
    </Page>
  )
}
