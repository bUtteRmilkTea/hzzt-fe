import { useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeftRight, Pipette } from 'lucide-react'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { api } from '@/shared/api/client'
import { errorMessage } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { ColorPicker } from '@/shared/ui/ColorPicker'
import {
  type CardMode,
  DIRECTIONS,
  type Direction,
  isDirection,
  resolveCardStyle,
} from '@/shared/ui/cardStyle'
import { cn } from '@/shared/ui/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { DEFAULT_SPACE_COLOR, PALETTE } from '@/shared/ui/palette'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { WalletCard } from '@/shared/ui/WalletCard'
import { type CardStylePayload, cardStyleSchema, toRequestCardStyle } from './cardStyleSchema'
import { useCardPresets, useCardTemplates, useInvalidateMoney, useWallet } from './hooks'

type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> }

interface Draft {
  mode: CardMode
  color: string
  colors: [string, string]
  direction: Direction
  presetId: string | null
  templateId: string
}

const ARROWS: Record<Direction, string> = {
  N: '↑',
  NE: '↗',
  E: '→',
  SE: '↘',
  S: '↓',
  SW: '↙',
  W: '←',
  NW: '↖',
}

/** The draft as the payload the backend expects for its mode. */
export function draftToPayload(d: Draft): CardStylePayload {
  const payload =
    d.mode === 'SOLID'
      ? { mode: 'SOLID', color: d.color }
      : d.mode === 'GRADIENT'
        ? { mode: 'GRADIENT', colors: d.colors, direction: d.direction, presetId: d.presetId }
        : { mode: 'TEMPLATE', templateId: d.templateId }
  return cardStyleSchema.parse(payload)
}

export function CardEditorScreen() {
  const { space } = useSpace()
  const { id } = useParams({ from: '/_authed/s/$spaceId/wallets/$id/card' })
  const wallet = useWallet(space.id, id)
  return (
    <Page width="wide" gap={8}>
      <PageHeader title="Card style" />
      {wallet.isPending ? (
        <Skeleton className="aspect-[1.7/1] w-full" />
      ) : wallet.isError || !wallet.data ? (
        <EmptyState
          title="Couldn't load this wallet"
          action={<Button onClick={() => void wallet.refetch()}>Try again</Button>}
        />
      ) : (
        <Editor key={wallet.data.id} walletId={id} wallet={wallet.data} />
      )}
    </Page>
  )
}

function initialDraft(
  style:
    | {
        mode?: string
        color?: string
        colors?: string[]
        direction?: string
        presetId?: string
        templateId?: string
      }
    | undefined,
): Draft {
  const c1 = style?.colors?.[0] ?? PALETTE[0]
  const c2 = style?.colors?.[1] ?? PALETTE[4]
  return {
    mode:
      style?.mode === 'GRADIENT' ? 'GRADIENT' : style?.mode === 'TEMPLATE' ? 'TEMPLATE' : 'SOLID',
    color: style?.color || DEFAULT_SPACE_COLOR,
    colors: [c1, c2],
    direction: isDirection(style?.direction) ? style.direction : 'SE',
    presetId: style?.presetId ?? null,
    templateId: style?.templateId ?? 'classic',
  }
}

function Editor({
  walletId,
  wallet,
}: {
  walletId: string
  wallet: NonNullable<ReturnType<typeof useWallet>['data']>
}) {
  const { space } = useSpace()
  const navigate = useNavigate()
  const toast = useToast()
  const invalidateMoney = useInvalidateMoney(space.id)
  const presets = useCardPresets()
  const templates = useCardTemplates()
  // Edits stay in this draft. Nothing is saved until Apply; leaving the page discards it.
  const [draft, setDraft] = useState<Draft>(() => initialDraft(wallet.cardStyle))
  const [slot, setSlot] = useState<0 | 1>(0)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const apply = useMutation({
    mutationFn: async (cardStyle: CardStylePayload) =>
      (
        await api.PATCH('/spaces/{spaceId}/wallets/{id}', {
          params: { path: { spaceId: space.id, id: walletId } },
          body: { cardStyle: toRequestCardStyle(cardStyle) },
        })
      ).data,
    meta: { silent: true },
    onSuccess: async () => {
      await invalidateMoney()
      toast.show('Card style applied', 'success')
      await navigate({ to: '/s/$spaceId/wallets/$id', params: { spaceId: space.id, id: walletId } })
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  const eyeDropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper
  const pickFromScreen = async (apply: (hex: string) => void) => {
    if (!eyeDropper) return
    try {
      apply((await new eyeDropper().open()).sRGBHex)
    } catch {
      // The user dismissed the eyedropper.
    }
  }

  return (
    <div
      data-testid="card-editor-layout"
      className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-x-10 lg:gap-y-6"
    >
      {/* From 1024px: controls on the left, a sticky preview on the right (same grid as Edit wallet). */}
      <div
        data-testid="card-preview"
        className="lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <WalletCard
          size="compact"
          name={wallet.name ?? ''}
          icon={wallet.icon ?? '💳'}
          balance={wallet.balance ?? '0'}
          currency={wallet.currency ?? ''}
          type={wallet.type ?? 'OTHER'}
          isFavorite={wallet.isFavorite}
          cardStyle={
            draft.mode === 'SOLID'
              ? { mode: 'SOLID', color: draft.color }
              : draft.mode === 'GRADIENT'
                ? { mode: 'GRADIENT', colors: draft.colors, direction: draft.direction }
                : { mode: 'TEMPLATE', templateId: draft.templateId }
          }
        />
      </div>

      <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
        <SegmentedControl
          aria-label="Card style type"
          value={draft.mode}
          onValueChange={(mode) => set({ mode })}
          options={[
            { value: 'SOLID', label: 'Solid' },
            { value: 'GRADIENT', label: 'Gradient' },
            { value: 'TEMPLATE', label: 'Template' },
          ]}
        />

        {draft.mode === 'SOLID' ? (
          <div className="flex flex-col gap-3">
            <ColorPicker
              label="Card colour"
              value={draft.color}
              onChange={(color) => set({ color })}
            />
            {eyeDropper ? (
              <Button
                variant="secondary"
                onClick={() => void pickFromScreen((color) => set({ color }))}
              >
                <Pipette aria-hidden className="size-5" /> Pick from screen
              </Button>
            ) : null}
          </div>
        ) : null}

        {draft.mode === 'GRADIENT' ? (
          <div className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-medium text-label-secondary">Colours</legend>
              <div className="flex items-center gap-3">
                {([0, 1] as const).map((i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Gradient colour ${i + 1}`}
                    aria-pressed={slot === i}
                    onClick={() => setSlot(i)}
                    style={{ backgroundColor: draft.colors[i] }}
                    className={cn(
                      'size-12 rounded-full border-2 border-transparent',
                      slot === i && 'ring-2 ring-label ring-offset-2 ring-offset-bg',
                    )}
                  />
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Swap colours"
                  onClick={() =>
                    set({ colors: [draft.colors[1], draft.colors[0]], presetId: null })
                  }
                >
                  <ArrowLeftRight aria-hidden className="size-5" />
                </Button>
                {eyeDropper ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Pick from screen"
                    onClick={() =>
                      void pickFromScreen((hex) => {
                        const next: [string, string] = [...draft.colors]
                        next[slot] = hex
                        set({ colors: next, presetId: null })
                      })
                    }
                  >
                    <Pipette aria-hidden className="size-5" />
                  </Button>
                ) : null}
              </div>
              <ColorPicker
                label={`Colour ${slot + 1}`}
                value={draft.colors[slot]}
                onChange={(hex) => {
                  const next: [string, string] = [...draft.colors]
                  next[slot] = hex
                  set({ colors: next, presetId: null })
                }}
              />
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-medium text-label-secondary">Direction</legend>
              <div className="grid max-w-md grid-cols-4 gap-2">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-label={`Direction ${d}`}
                    aria-pressed={draft.direction === d}
                    onClick={() => set({ direction: d })}
                    className={cn(
                      'flex min-h-11 items-center justify-center rounded-md bg-surface-3 text-lg',
                      draft.direction === d && 'ring-2 ring-accent',
                    )}
                  >
                    {ARROWS[d]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-medium text-label-secondary">Presets</legend>
              <div className="flex flex-wrap gap-2">
                {(presets.data ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={draft.presetId === p.id}
                    onClick={() =>
                      set({
                        presetId: p.id ?? null,
                        colors: [
                          p.colors?.[0] ?? draft.colors[0],
                          p.colors?.[1] ?? draft.colors[1],
                        ],
                        direction: isDirection(p.direction) ? p.direction : draft.direction,
                      })
                    }
                    className={cn(
                      'min-h-11 rounded-full border border-border bg-surface-3 px-4 text-sm',
                      draft.presetId === p.id && 'ring-2 ring-accent',
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}

        {draft.mode === 'TEMPLATE' ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-label-secondary">Templates</legend>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              {(templates.data ?? []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`Template ${t.name}`}
                  aria-pressed={draft.templateId === t.id}
                  onClick={() => set({ templateId: t.id as string })}
                  className={cn(
                    'flex flex-col gap-1 rounded-md',
                    draft.templateId === t.id && 'ring-2 ring-accent',
                  )}
                >
                  <span
                    aria-hidden
                    style={{
                      background: resolveCardStyle({ mode: 'TEMPLATE', templateId: t.id })
                        .background,
                    }}
                    className="aspect-[1.7/1] w-full rounded-md"
                  />
                  <span className="text-xs text-label-secondary">{t.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>

      <div className="pb-safe sticky bottom-24 z-10 flex gap-3 bg-bg/90 py-3 backdrop-blur-[20px] lg:bottom-4 lg:col-start-1 lg:row-start-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() =>
            navigate({ to: '/s/$spaceId/wallets/$id', params: { spaceId: space.id, id: walletId } })
          }
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={apply.isPending}
          onClick={() => apply.mutate(draftToPayload(draft))}
        >
          {apply.isPending ? 'Applying…' : 'Apply'}
        </Button>
      </div>
    </div>
  )
}
