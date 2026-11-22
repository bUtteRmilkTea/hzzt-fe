import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage } from '@/shared/api/errors'
import { PieChart } from '@/shared/charts'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageGrid, Panel } from '@/shared/ui/PageGrid'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { CreateWalletSheet } from './CreateWalletSheet'
import { moveItem, useReorderWallets, useWallets } from './hooks'
import { walletPieSlices } from './pie'
import { WalletStack } from './WalletStack'

export function WalletsScreen() {
  const { space } = useSpace()
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

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Wallets</h1>
        <div className="flex gap-2">
          {wallets.data && wallets.data.items.length > 1 ? (
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
      ) : (
        <>
          <Card>
            <p className="text-sm text-label-secondary">Total balance</p>
            <p className="text-2xl font-semibold" data-testid="wallets-total">
              <Amount
                value={wallets.data.total.amount}
                currency={wallets.data.total.currency || space.baseCurrency}
              />
            </p>
          </Card>
          <WarningsStrip warnings={wallets.data.total.warnings} />

          {wallets.data.items.length === 0 ? (
            <EmptyState
              title="No wallets yet"
              description="Add a bank account, e-wallet or cash to start tracking."
              action={<Button onClick={() => setCreating(true)}>Add wallet</Button>}
            />
          ) : (
            <PageGrid>
              <div className="min-w-0 lg:col-span-7">
                <WalletStack
                  wallets={wallets.data.items}
                  spaceId={space.id}
                  expanded={expanded}
                  onExpandedChange={setExpanded}
                  forceExpanded={reordering}
                  renderAside={(w, i) =>
                    reordering ? (
                      <div className="flex flex-col gap-1">
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
                          disabled={i === wallets.data.items.length - 1}
                          onClick={() => move(i, i + 1)}
                        >
                          <ArrowDown aria-hidden className="size-5" />
                        </Button>
                      </div>
                    ) : null
                  }
                />
              </div>
              <Panel span={5} aria-label="Balance share" className="self-start">
                <h2 className="mb-3 text-base font-semibold">Share of balance</h2>
                <PieChart
                  slices={pieSlices}
                  currency={wallets.data.total.currency || space.baseCurrency}
                  label="Share of total balance per wallet"
                  showAmounts={false}
                />
              </Panel>
            </PageGrid>
          )}
        </>
      )}

      {creating ? <CreateWalletSheet onClose={() => setCreating(false)} /> : null}
    </div>
  )
}
