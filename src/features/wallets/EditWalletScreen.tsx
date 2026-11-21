import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useSpace } from '@/app/providers/SpaceProvider'
import { applyServerError } from '@/features/auth/useServerErrors'
import { useCurrencies } from '@/features/spaces/hooks'
import { api } from '@/shared/api/client'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { Decimal, format, parseInput } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmojiPicker } from '@/shared/ui/EmojiPicker'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { MoneyInput } from '@/shared/ui/MoneyInput'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { Select } from '@/shared/ui/Select'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Switch } from '@/shared/ui/Switch'
import { useToast } from '@/shared/ui/Toast'
import { WalletCard } from '@/shared/ui/WalletCard'
import { WALLET_TYPES } from './CreateWalletSheet'
import { type DisplayPrefs, prefsOf, useWalletDisplay } from './display'
import { useInvalidateMoney, useWallet, useWalletTransactions, type WalletDTO } from './hooks'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(120, 'Use at most 120 characters'),
  icon: z.string().min(1),
  type: z.enum(['BANK', 'E_WALLET', 'CASH', 'OTHER']),
  currency: z.string().min(1),
})
type Values = z.infer<typeof schema>

export function EditWalletScreen() {
  const { space } = useSpace()
  const { id } = useParams({ from: '/_authed/s/$spaceId/wallets/$id/edit' })
  const wallet = useWallet(space.id, id)

  return (
    <Page width="wide" gap={8}>
      <PageHeader title="Edit wallet" />
      {wallet.isPending ? (
        <Skeleton className="h-64" />
      ) : wallet.isError || !wallet.data ? (
        <EmptyState
          title="Couldn't load this wallet"
          action={<Button onClick={() => void wallet.refetch()}>Try again</Button>}
        />
      ) : (
        <EditLayout key={wallet.data.id} wallet={wallet.data} />
      )}
    </Page>
  )
}

/** The form and balance adjustment on the left; a live card preview and display options on the right. */
function EditLayout({ wallet }: { wallet: WalletDTO }) {
  // What the card would look like with the form's current values (the saved wallet until the user types).
  const [preview, setPreview] = useState<Partial<Values>>({})
  return (
    <div
      data-testid="edit-wallet-layout"
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10"
    >
      <div className="flex min-w-0 flex-col gap-8">
        <DetailsForm wallet={wallet} onPreview={setPreview} />
        <AdjustBalance wallet={wallet} />
      </div>
      <aside
        aria-label="Preview"
        className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-4"
        data-testid="wallet-preview"
      >
        <WalletCard
          size="compact"
          name={preview.name ?? wallet.name ?? ''}
          icon={preview.icon ?? wallet.icon ?? '💳'}
          balance={wallet.balance ?? '0'}
          currency={preview.currency ?? wallet.currency ?? ''}
          type={preview.type ?? wallet.type ?? 'OTHER'}
          cardStyle={wallet.cardStyle}
          isFavorite={wallet.isFavorite}
          display={prefsOf(wallet)}
        />
        <DisplaySection wallet={wallet} />
      </aside>
    </div>
  )
}

function DetailsForm({
  wallet,
  onPreview,
}: {
  wallet: WalletDTO
  onPreview?: (v: Partial<Values>) => void
}) {
  const { space } = useSpace()
  const toast = useToast()
  const invalidateMoney = useInvalidateMoney(space.id)
  const { data: currencies = [] } = useCurrencies()
  // Any transaction at all (an opening balance counts) locks the currency.
  const existing = useWalletTransactions(
    space.id,
    wallet.id as string,
    { kind: 'preset', preset: 'ALL_TIME' },
    1,
  )
  const hasTransactions = (existing.data?.pages[0]?.items.length ?? 0) > 0
  const [lockedByServer, setLockedByServer] = useState(false)
  const currencyLocked = hasTransactions || lockedByServer
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: wallet.name ?? '',
      icon: wallet.icon ?? '💳',
      type: (wallet.type as Values['type']) ?? 'BANK',
      currency: wallet.currency ?? space.baseCurrency,
    },
  })

  // Feed the live preview beside the form.
  const watched = useWatch({ control })
  useEffect(() => {
    onPreview?.(watched as Partial<Values>)
  }, [watched, onPreview])

  const save = useMutation({
    mutationFn: async (v: Values) => {
      // Never send the currency when it is locked: the server would refuse it.
      const body = currencyLocked ? { name: v.name, icon: v.icon, type: v.type } : v
      return (
        await api.PATCH('/spaces/{spaceId}/wallets/{id}', {
          params: { path: { spaceId: space.id, id: wallet.id as string } },
          body,
        })
      ).data
    },
    meta: { silent: true },
    onSuccess: async (_d, vars) => {
      await invalidateMoney()
      reset(vars)
      toast.show('Wallet saved', 'success')
    },
    onError: (err) => {
      if (toAppError(err).code === 'WALLET_CURRENCY_LOCKED') {
        setLockedByServer(true)
        setFormError(errorMessage(err))
        return
      }
      setFormError(applyServerError(err, setError, ['name', 'icon', 'type', 'currency']))
    },
  })

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={handleSubmit((v) => {
        setFormError(null)
        save.mutate(v)
      })}
    >
      {formError ? (
        <p role="alert" className="text-sm text-negative">
          {formError}
        </p>
      ) : null}
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <SegmentedControl
            aria-label="Wallet type"
            value={field.value}
            onValueChange={field.onChange}
            options={WALLET_TYPES}
          />
        )}
      />
      <Field label="Name" error={errors.name?.message}>
        <Input maxLength={120} {...register('name')} />
      </Field>
      <Field
        label="Currency"
        hint={currencyLocked ? "Currency can't change once a wallet has transactions." : undefined}
      >
        <Select disabled={currencyLocked} {...register('currency')}>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
          {currencies.length === 0 ? (
            <option value={wallet.currency}>{wallet.currency}</option>
          ) : null}
        </Select>
      </Field>
      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <EmojiPicker label="Icon" value={field.value} onChange={field.onChange} />
        )}
      />
      <Button type="submit" disabled={!isDirty || save.isPending}>
        {save.isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}

function AdjustBalance({ wallet }: { wallet: WalletDTO }) {
  const { space } = useSpace()
  const toast = useToast()
  const invalidateMoney = useInvalidateMoney(space.id)
  const currency = wallet.currency ?? ''
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const normalised = value ? parseInput(value, currency) : null
  const current = new Decimal(wallet.balance ?? '0')
  const difference = normalised === null ? null : new Decimal(normalised).minus(current)
  const changed = difference !== null && !difference.isZero()

  const adjust = useMutation({
    mutationFn: async (body: { newBalance: string; note?: string }) =>
      (
        await api.PUT('/spaces/{spaceId}/wallets/{id}/balance', {
          params: { path: { spaceId: space.id, id: wallet.id as string } },
          body,
        })
      ).data,
    meta: { silent: true },
    onSuccess: async () => {
      await invalidateMoney()
      setValue('')
      setNote('')
      toast.show('Balance adjusted', 'success')
    },
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <section aria-labelledby="adjust-heading" className="flex flex-col gap-4">
      <h2 id="adjust-heading" className="text-lg font-medium">
        Adjust balance
      </h2>
      <p className="text-sm text-label-secondary">
        Set the balance to what it really is. The difference is recorded as an adjustment in this
        wallet's history.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      <Field label="New balance">
        <MoneyInput value={value} onChange={setValue} currency={currency} />
      </Field>
      <Card className="flex flex-col gap-1" data-testid="adjust-preview">
        <p className="flex justify-between text-sm">
          <span className="text-label-secondary">Before</span>
          <Amount value={wallet.balance ?? '0'} currency={currency} />
        </p>
        <p className="flex justify-between text-sm">
          <span className="text-label-secondary">After</span>
          {normalised === null ? <span>—</span> : <Amount value={normalised} currency={currency} />}
        </p>
        {changed && difference ? (
          <p className="flex justify-between text-sm">
            <span className="text-label-secondary">Adjustment</span>
            <Amount
              value={difference.toFixed()}
              currency={currency}
              tone="auto"
              signDisplay="always"
            />
          </p>
        ) : null}
      </Card>
      <Field label="Note (optional)">
        <Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button
        disabled={!changed || adjust.isPending}
        onClick={() => {
          setError(null)
          if (normalised)
            adjust.mutate({ newBalance: normalised, ...(note.trim() ? { note: note.trim() } : {}) })
        }}
      >
        {adjust.isPending
          ? 'Saving…'
          : `Set balance${normalised ? ` to ${format(normalised, currency)}` : ''}`}
      </Button>
    </section>
  )
}

const DISPLAY_TOGGLES: Array<{ key: keyof DisplayPrefs; label: string }> = [
  { key: 'hideLogo', label: 'Hide logo' },
  { key: 'hideName', label: 'Hide name' },
  { key: 'hideType', label: 'Hide type' },
]

/** Per-user card display flags, saved at once (synced across devices by the backend). */
function DisplaySection({ wallet }: { wallet: WalletDTO }) {
  const { space } = useSpace()
  const toast = useToast()
  const display = useWalletDisplay(space.id, wallet.id as string)
  const prefs = prefsOf(wallet)
  return (
    <section className="flex flex-col gap-3" aria-label="Card display">
      <h2 className="text-lg font-medium">Card display</h2>
      <p className="text-sm text-label-secondary">
        Only you see these changes. They follow you across devices.
      </p>
      <Card className="flex flex-col divide-y divide-border p-0">
        {DISPLAY_TOGGLES.map((t) => (
          <div key={t.key} className="flex items-center justify-between px-4">
            <span>{t.label}</span>
            <Switch
              aria-label={t.label}
              checked={prefs[t.key]}
              onCheckedChange={(checked) =>
                display.mutate(
                  { [t.key]: checked },
                  { onError: (e) => toast.show(errorMessage(e), 'error') },
                )
              }
            />
          </div>
        ))}
      </Card>
    </section>
  )
}
