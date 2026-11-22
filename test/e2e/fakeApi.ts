import type { Page } from '@playwright/test'
import { PALETTE } from '../../src/shared/ui/palette'
import { metas } from '../msw/investments'

/**
 * A tiny stateful stand-in for the Go API, installed at the browser level so e2e
 * needs no running backend. `signedIn` plays the role of the httpOnly refresh cookie.
 */
interface FakeWallet {
  id: string
  name: string
  icon: string
  type: string
  currency: string
  balance: string
  sortOrder: number
  isFavorite: boolean
  cardStyle: Record<string, unknown>
}
interface FakeTxn {
  id: string
  walletId: string
  type: string
  direction: 'IN' | 'OUT'
  amount: string
  currency: string
  title: string
  occurredAt: string
}

interface FakeCategory {
  id: string
  name: string
  type: 'EXPENSE' | 'INCOME'
  icon: string
  color: string
  sortOrder: number
  budgetAmount?: string
  /** Spend so far, set by the test to play the part of recorded transactions. */
  spent: number
}

interface FakeInvestment {
  id: string
  name: string
  symbol: string
  icon: string
  assetType: string
  priceMode: string
  quoteCurrency: string
  quantity: string
  avgBuyPrice: string
  price: string
  wrapper?: string
  details?: Record<string, unknown>
  participants: Array<Record<string, unknown>>
}

interface FakeAsset {
  id: string
  kind: 'FIXED_ASSET' | 'RECEIVABLE' | 'LIABILITY'
  name: string
  icon: string
  currency: string
  currentValue: string
}
interface FakeGoal {
  id: string
  name: string
  icon: string
  currency: string
  targetAmount: string
  /** walletId -> reserved amount */
  reserves: Record<string, number>
}

export interface FakeApi {
  assets: FakeAsset[]
  goals: FakeGoal[]
  investments: FakeInvestment[]
  /** Wrapper targets, keyed `${assetType}/${wrapperKey}`. */
  wrapperTargets: Record<string, string>
  categories: FakeCategory[]
  wallets: FakeWallet[]
  transactions: FakeTxn[]
  calls: { refresh: number }
  signedIn: boolean
  /** Space ids passed to POST /spaces/{id}/activate, in order. */
  activated: string[]
  preferences: { hideAmounts: boolean; keyboardType: string; appLockEnabled: boolean }
  /** Wrong PINs seen so far by /me/app-lock/verify. */
  wrongPins: number
}

const user = {
  id: 'u-1',
  email: 'jane@example.com',
  name: 'Jane',
  timezone: 'Asia/Jakarta',
  lastActiveSpaceId: 's-1',
}
const spaces = [
  {
    id: 's-1',
    name: 'Home',
    role: 'OWNER',
    baseCurrency: 'IDR',
    trackingMode: 'FULL_NET_WORTH',
    autoFxConversion: true,
    avatarEmoji: '🏠',
    avatarColor: PALETTE[0],
    memberCount: 2,
  },
  {
    id: 's-2',
    name: 'Family',
    role: 'MEMBER',
    baseCurrency: 'USD',
    trackingMode: 'FULL_NET_WORTH',
    autoFxConversion: true,
    avatarEmoji: '👨‍👩‍👧',
    avatarColor: PALETTE[7],
    memberCount: 3,
  },
]
const currencies = [
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', minorUnits: 0 },
  { code: 'USD', name: 'US Dollar', symbol: '$', minorUnits: 2 },
]
const auth = { accessToken: 'e2e-access-token', expiresIn: 900, user }
const envelope = (code: string, message = '', details?: Record<string, unknown>) => ({
  error: { code, message, details },
  requestId: 'req-e2e',
})

export async function installFakeApi(
  page: Page,
  opts: { signedIn?: boolean; appLock?: boolean } = {},
) {
  const state: FakeApi = {
    signedIn: opts.signedIn ?? false,
    calls: { refresh: 0 },
    activated: [],
    assets: [],
    goals: [],
    investments: [],
    wrapperTargets: {},
    categories: [],
    wallets: [],
    transactions: [],
    preferences: {
      hideAmounts: false,
      keyboardType: 'MINI_CALCULATOR',
      appLockEnabled: opts.appLock ?? false,
    },
    wrongPins: 0,
  }

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '')
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    const reservedOn = (walletId: string) =>
      state.goals.reduce((n, g) => n + (g.reserves[walletId] ?? 0), 0)
    // wallets expose reserved/available, as the real API does
    const withReserve = (w: FakeWallet) => ({
      ...w,
      reserved: String(reservedOn(w.id)),
      available: String(Number(w.balance) - reservedOn(w.id)),
      overReserved: Number(w.balance) < reservedOn(w.id),
    })
    const activate = /^\/spaces\/([^/]+)\/activate$/.exec(path)
    if (req.method() === 'POST' && activate) {
      state.activated.push(activate[1] as string)
      return route.fulfill({ status: 204 })
    }
    const members = /^\/spaces\/([^/]+)\/members$/.exec(path)
    if (req.method() === 'GET' && members) {
      return json(200, [{ userId: 'u-1', name: 'Jane', email: 'jane@example.com', role: 'OWNER' }])
    }
    if (req.method() === 'GET' && /^\/spaces\/[^/]+\/invitations\/active$/.test(path)) {
      return json(200, {})
    }

    const wallet = /^\/spaces\/([^/]+)\/wallets(?:\/([^/]+))?(?:\/(balance|top-up))?$/.exec(path)
    if (wallet) {
      const [, , id, sub] = wallet
      const listBody = () => ({
        items: [...state.wallets].sort((a, b) => a.sortOrder - b.sortOrder),
        total: {
          total: String(state.wallets.reduce((n, w) => n + Number(w.balance), 0)),
          currency: 'IDR',
          warnings: [],
        },
      })
      const find = () => state.wallets.find((w) => w.id === id)
      const record = (
        w: FakeWallet,
        type: string,
        direction: 'IN' | 'OUT',
        amount: string,
        title: string,
      ) =>
        state.transactions.unshift({
          id: `t-${state.transactions.length + 1}`,
          walletId: w.id,
          type,
          direction,
          amount,
          currency: w.currency,
          title,
          occurredAt: new Date().toISOString(),
        })
      if (!id && req.method() === 'GET')
        return json(200, { ...listBody(), items: listBody().items.map(withReserve) })
      if (!id && req.method() === 'POST') {
        const b = req.postDataJSON() as Partial<FakeWallet> & { initialBalance?: string }
        const w: FakeWallet = {
          id: `w-${state.wallets.length + 1}`,
          name: b.name ?? '',
          icon: b.icon ?? '💳',
          type: b.type ?? 'BANK',
          currency: b.currency ?? 'IDR',
          balance: b.initialBalance ?? '0',
          sortOrder: state.wallets.length,
          isFavorite: false,
          cardStyle: b.cardStyle ?? {},
        }
        state.wallets.push(w)
        if (b.initialBalance)
          record(w, 'OPENING_BALANCE', 'IN', b.initialBalance, 'Opening balance')
        return json(201, w)
      }
      if (id === 'order' && req.method() === 'PUT') {
        const { ids } = req.postDataJSON() as { ids: string[] }
        ids.forEach((wid, i) => {
          const w = state.wallets.find((x) => x.id === wid)
          if (w) w.sortOrder = i
        })
        return json(200, listBody())
      }
      const w = find()
      if (!w) return json(404, envelope('NOT_FOUND'))
      if (!sub && req.method() === 'GET') return json(200, withReserve(w))
      if (!sub && req.method() === 'PATCH') {
        Object.assign(w, req.postDataJSON())
        return json(200, w)
      }
      if (!sub && req.method() === 'DELETE') {
        const force = new URL(req.url()).searchParams.get('force') === 'true'
        if (Number(w.balance) !== 0 && !force) return json(422, envelope('WALLET_HAS_BALANCE'))
        state.wallets = state.wallets.filter((x) => x.id !== w.id)
        return route.fulfill({ status: 204 })
      }
      if (sub === 'balance' && req.method() === 'PUT') {
        const { newBalance } = req.postDataJSON() as { newBalance: string }
        const diff = Number(newBalance) - Number(w.balance)
        w.balance = newBalance
        record(
          w,
          'ADJUSTMENT',
          diff >= 0 ? 'IN' : 'OUT',
          String(Math.abs(diff)),
          'Balance adjustment',
        )
        return json(200, w)
      }
      if (sub === 'top-up' && req.method() === 'POST') {
        const { amount } = req.postDataJSON() as { amount: string }
        w.balance = String(Number(w.balance) + Number(amount))
        record(w, 'INCOME', 'IN', amount, 'Top up')
        return json(201, state.transactions[0])
      }
    }
    const txnRoute = /^\/spaces\/[^/]+\/(transactions|transfers)(?:\/([^/]+))?$/.exec(path)
    if (txnRoute && !path.endsWith('daily-summary') && !(req.method() === 'GET' && !txnRoute[2])) {
      const [, kind, tid] = txnRoute
      const addTxn = (t: Omit<FakeTxn, 'id' | 'occurredAt'> & { occurredAt?: string }) => {
        const row: FakeTxn = {
          ...t,
          id: `t-${state.transactions.length + 1}`,
          occurredAt: t.occurredAt ?? new Date().toISOString(),
        }
        state.transactions.unshift(row)
        return row
      }
      const wallet = (id: string) => state.wallets.find((w) => w.id === id)
      if (!tid && req.method() === 'POST' && kind === 'transactions') {
        const b = req.postDataJSON() as {
          type: 'INCOME' | 'EXPENSE'
          walletId: string
          amount: string
          occurredAt?: string
          categoryId?: string
          note?: string
        }
        const w = wallet(b.walletId)
        if (!w) return json(404, envelope('NOT_FOUND'))
        w.balance = String(Number(w.balance) + (b.type === 'INCOME' ? 1 : -1) * Number(b.amount))
        const row = addTxn({
          walletId: w.id,
          type: b.type,
          direction: b.type === 'INCOME' ? 'IN' : 'OUT',
          amount: b.amount,
          currency: w.currency,
          title: b.note ?? '',
          occurredAt: b.occurredAt,
        })
        return json(201, row)
      }
      if (!tid && req.method() === 'POST' && kind === 'transfers') {
        const b = req.postDataJSON() as {
          from: { walletId: string }
          to: { walletId: string }
          amount: string
          toAmount?: string
        }
        const from = wallet(b.from.walletId)
        const to = wallet(b.to.walletId)
        if (!from || !to) return json(404, envelope('NOT_FOUND'))
        if (from.id === to.id) return json(422, envelope('TRANSFER_SAME_WALLET'))
        if (from.currency !== to.currency && !b.toAmount)
          return json(422, envelope('TRANSFER_AMOUNT_REQUIRED'))
        from.balance = String(Number(from.balance) - Number(b.amount))
        to.balance = String(Number(to.balance) + Number(b.toAmount ?? b.amount))
        const row = addTxn({
          walletId: from.id,
          type: 'TRANSFER',
          direction: 'OUT',
          amount: b.amount,
          currency: from.currency,
          title: 'Transfer',
        })
        return json(201, row)
      }
      const existing = state.transactions.find((t) => t.id === tid)
      if (tid && existing && req.method() === 'GET')
        return json(200, {
          ...existing,
          wallet: { id: existing.walletId, name: wallet(existing.walletId)?.name ?? '' },
        })
      if (tid && existing && req.method() === 'DELETE') {
        const w = wallet(existing.walletId)
        if (w)
          w.balance = String(
            Number(w.balance) + (existing.direction === 'IN' ? -1 : 1) * Number(existing.amount),
          )
        state.transactions = state.transactions.filter((t) => t.id !== tid)
        return route.fulfill({ status: 204 })
      }
    }
    if (req.method() === 'GET' && /^\/spaces\/[^/]+\/transactions\/daily-summary$/.test(path)) {
      const days = new Map<string, { income: number; expense: number; count: number }>()
      for (const t of state.transactions) {
        const d = t.occurredAt.slice(0, 10)
        const e = days.get(d) ?? { income: 0, expense: 0, count: 0 }
        if (t.type === 'INCOME') e.income += Number(t.amount)
        if (t.type === 'EXPENSE') e.expense += Number(t.amount)
        e.count++
        days.set(d, e)
      }
      return json(200, {
        currency: 'IDR',
        warnings: [],
        items: [...days.entries()].map(([date, v]) => ({
          date,
          count: v.count,
          income: String(v.income),
          expense: String(v.expense),
          transfer: '0',
        })),
      })
    }
    if (req.method() === 'GET' && /^\/spaces\/[^/]+\/transactions$/.test(path)) {
      const ids = new URL(req.url()).searchParams.getAll('walletIds')
      const q = new URL(req.url()).searchParams.get('q')?.toLowerCase()
      const items = state.transactions
        .filter((t) => ids.length === 0 || ids.includes(t.walletId))
        .filter((t) => !q || t.title.toLowerCase().includes(q))
        .map((t) => ({ ...t, wallet: { id: t.walletId, name: '' } }))
      return json(200, { items })
    }
    if (req.method() === 'GET' && /^\/spaces\/[^/]+\/net-worth\/summary$/.test(path)) {
      const sum = (k: FakeAsset['kind']) =>
        state.assets.filter((a) => a.kind === k).reduce((n, a) => n + Number(a.currentValue), 0)
      const cash = state.wallets.reduce((n, w) => n + Number(w.balance), 0)
      return json(200, {
        currency: 'IDR',
        cash: String(cash),
        fixedAssets: String(sum('FIXED_ASSET')),
        receivables: String(sum('RECEIVABLE')),
        liabilities: String(sum('LIABILITY')),
        netWorth: String(cash + sum('FIXED_ASSET') + sum('RECEIVABLE') - sum('LIABILITY')),
        trackingMode: 'FULL_NET_WORTH',
        warnings: [],
        investments: { value: '0', cost: '0', unrealizedPl: '0', unrealizedPlPct: null },
      })
    }
    if (req.method() === 'GET' && /^\/spaces\/[^/]+\/net-worth\/history$/.test(path))
      return json(200, { currency: 'IDR', range: '1M', points: [] })
    const assetRoute = /^\/spaces\/[^/]+\/manual-assets(?:\/([^/]+))?(?:\/(settlements))?$/.exec(
      path,
    )
    if (assetRoute) {
      const [, aid, sub] = assetRoute
      const view = (a: FakeAsset) => ({ ...a, history: [] })
      if (!aid && req.method() === 'GET') {
        const kind = new URL(req.url()).searchParams.get('kind')
        const items = state.assets.filter((a) => a.kind === kind)
        return json(200, {
          items: items.map(view),
          totals: {
            [kind ?? '']: {
              total: String(items.reduce((n, a) => n + Number(a.currentValue), 0)),
              currency: 'IDR',
              warnings: [],
            },
          },
        })
      }
      if (!aid && req.method() === 'POST') {
        const b = req.postDataJSON() as Partial<FakeAsset>
        const a: FakeAsset = {
          id: `a-${state.assets.length + 1}`,
          kind: b.kind ?? 'FIXED_ASSET',
          name: b.name ?? '',
          icon: b.icon ?? '🏠',
          currency: b.currency ?? 'IDR',
          currentValue: b.currentValue ?? '0',
        }
        state.assets.push(a)
        return json(201, view(a))
      }
      const asset = state.assets.find((a) => a.id === aid)
      if (!asset) return json(404, envelope('NOT_FOUND'))
      if (!sub && req.method() === 'GET') return json(200, view(asset))
      if (sub === 'settlements' && req.method() === 'POST') {
        const b = req.postDataJSON() as { walletId: string; amount: string }
        const w = state.wallets.find((x) => x.id === b.walletId)
        if (!w) return json(404, envelope('NOT_FOUND'))
        if (Number(b.amount) > Number(asset.currentValue))
          return json(422, envelope('SETTLEMENT_EXCEEDS_BALANCE'))
        asset.currentValue = String(Number(asset.currentValue) - Number(b.amount))
        w.balance = String(
          Number(w.balance) + (asset.kind === 'LIABILITY' ? -1 : 1) * Number(b.amount),
        )
        return json(201, { asset: view(asset), transaction: {} })
      }
    }
    const goalRoute = /^\/spaces\/[^/]+\/goals(?:\/([^/]+))?(?:\/allocations\/([^/]+))?$/.exec(path)
    if (goalRoute) {
      const [, gid, wid] = goalRoute
      const view = (g: FakeGoal) => {
        const progress = Object.values(g.reserves).reduce((n, v) => n + v, 0)
        const pct = (progress / Number(g.targetAmount)) * 100
        return {
          id: g.id,
          name: g.name,
          icon: g.icon,
          color: PALETTE[0],
          currency: g.currency,
          targetAmount: g.targetAmount,
          progress: String(progress),
          progressPct: pct.toFixed(2),
          remaining: String(Math.max(0, Number(g.targetAmount) - progress)),
          warnings: [],
          allocations: Object.entries(g.reserves).map(([walletId, amount]) => ({
            walletId,
            walletName: state.wallets.find((w) => w.id === walletId)?.name,
            walletCurrency: g.currency,
            amount: String(amount),
            converted: String(amount),
          })),
          ...(progress >= Number(g.targetAmount) ? { achievedAt: new Date().toISOString() } : {}),
        }
      }
      if (!gid && req.method() === 'GET') return json(200, { items: state.goals.map(view) })
      if (!gid && req.method() === 'POST') {
        const b = req.postDataJSON() as {
          name: string
          icon: string
          currency?: string
          targetAmount: string
          initialReserve?: { walletId: string; amount: string }
        }
        const g: FakeGoal = {
          id: `g-${state.goals.length + 1}`,
          name: b.name,
          icon: b.icon,
          currency: b.currency ?? 'IDR',
          targetAmount: b.targetAmount,
          reserves: {},
        }
        if (b.initialReserve) {
          const w = state.wallets.find((x) => x.id === b.initialReserve?.walletId)
          if (!w || Number(b.initialReserve.amount) > Number(w.balance) - reservedOn(w.id))
            return json(422, envelope('INSUFFICIENT_AVAILABLE_BALANCE'))
          g.reserves[w.id] = Number(b.initialReserve.amount)
        }
        state.goals.push(g)
        return json(201, view(g))
      }
      const goal = state.goals.find((x) => x.id === gid)
      if (!goal) return json(404, envelope('NOT_FOUND'))
      if (!wid && req.method() === 'GET') return json(200, view(goal))
      if (wid && req.method() === 'PUT') {
        const { amount } = req.postDataJSON() as { amount: string }
        const w = state.wallets.find((x) => x.id === wid)
        if (!w) return json(404, envelope('NOT_FOUND'))
        if (Number(amount) > Number(w.balance) - reservedOn(w.id) + (goal.reserves[w.id] ?? 0))
          return json(422, envelope('INSUFFICIENT_AVAILABLE_BALANCE'))
        goal.reserves[w.id] = Number(amount)
        return json(200, view(goal))
      }
    }
    if (req.method() === 'GET' && path === '/investment-types') return json(200, metas)
    if (req.method() === 'GET' && path === '/market/crypto/search') {
      return json(200, [{ instrumentId: 'inst-btc', symbol: 'BTC', name: 'Bitcoin', rank: 1 }])
    }
    const wrapRoute = /^\/spaces\/[^/]+\/investments\/wrappers(?:\/([^/]+)\/([^/]+))?$/.exec(path)
    if (wrapRoute) {
      const [, type, key] = wrapRoute
      if (req.method() === 'GET')
        return json(200, {
          items: Object.entries(state.wrapperTargets).map(([k, targetPct]) => {
            const [assetType, wrapperKey] = k.split('/')
            return { assetType, key: wrapperKey, targetPct }
          }),
        })
      if (req.method() === 'PATCH' && type && key) {
        const { targetPct } = req.postDataJSON() as { targetPct: string | null }
        const id = `${type}/${decodeURIComponent(key)}`
        if (targetPct === null) delete state.wrapperTargets[id]
        else state.wrapperTargets[id] = targetPct
        return json(200, { assetType: type, targetPct })
      }
    }
    const invRoute = /^\/spaces\/[^/]+\/investments(?:\/([^/]+))?(?:\/(participants))?$/.exec(path)
    if (invRoute) {
      const [, iid, sub] = invRoute
      const view = (i: FakeInvestment) => {
        const value = Number(i.quantity) * Number(i.price)
        const cost = Number(i.quantity) * Number(i.avgBuyPrice)
        return {
          id: i.id,
          name: i.name,
          symbol: i.symbol,
          icon: i.icon,
          assetType: i.assetType,
          priceMode: i.priceMode,
          quoteCurrency: i.quoteCurrency,
          quantity: i.quantity,
          avgBuyPrice: i.avgBuyPrice,
          ownership: 'OWNER',
          isShared: i.participants.length > 1,
          myShareBps: 10000,
          wrapper: i.wrapper,
          details: i.details ?? {},
          valuation: {
            price: i.price,
            priceSource: 'MARKET',
            priceAsOf: new Date().toISOString(),
            isStale: false,
            marketValue: String(value),
            costBasis: String(cost),
            unrealizedPl: String(value - cost),
            unrealizedPlPct: cost ? (((value - cost) / cost) * 100).toFixed(2) : null,
            base: {
              currency: i.quoteCurrency,
              marketValue: String(value),
              costBasis: String(cost),
              unrealizedPl: String(value - cost),
              fxRate: '1',
            },
            warnings: [],
          },
        }
      }
      if (!iid && req.method() === 'GET') {
        const total = state.investments.reduce(
          (n, i) => n + Number(i.quantity) * Number(i.price),
          0,
        )
        return json(200, {
          items: state.investments.map(view),
          summary: {
            currency: 'USD',
            totalValue: String(total),
            totalCost: String(total),
            unrealizedPl: '0',
            unrealizedPlPct: '0',
            warnings: [],
          },
        })
      }
      if (!iid && req.method() === 'POST') {
        const b = req.postDataJSON() as Partial<FakeInvestment> & { manualPrice?: string }
        const i: FakeInvestment = {
          id: `i-${state.investments.length + 1}`,
          name: b.name ?? '',
          symbol: b.symbol ?? '',
          icon: b.icon ?? '🪙',
          assetType: b.assetType ?? 'CRYPTO',
          priceMode: b.priceMode ?? 'MANUAL',
          quoteCurrency: 'USD',
          quantity: b.quantity ?? '0',
          avgBuyPrice: b.avgBuyPrice ?? '0',
          price: b.manualPrice ?? '100',
          participants: [
            {
              id: 'p-1',
              role: 'OWNER',
              displayName: 'Jane',
              isMe: true,
              sharePct: '100.00',
              status: 'ACTIVE',
            },
          ],
        }
        state.investments.push(i)
        return json(201, view(i))
      }
      const inv = state.investments.find((x) => x.id === iid)
      if (!inv) return json(404, envelope('NOT_FOUND'))
      if (!sub && req.method() === 'GET') return json(200, view(inv))
      if (sub === 'participants' && req.method() === 'GET')
        return json(200, { items: inv.participants })
      if (sub === 'participants' && req.method() === 'PUT') {
        const { participants } = req.postDataJSON() as { participants: Array<{ sharePct: string }> }
        const sum = participants.reduce((n, p) => n + Math.round(Number(p.sharePct) * 100), 0)
        if (sum !== 10000) return json(422, envelope('SHARE_TOTAL_INVALID'))
        inv.participants = participants.map((p, k) => ({
          id: `p-${k + 1}`,
          ...p,
          role: k === 0 ? 'OWNER' : 'PARTICIPANT',
          status: 'ACTIVE',
        }))
        return json(200, { items: inv.participants })
      }
    }
    if (req.method() === 'POST' && /^\/spaces\/[^/]+\/transfers$/.test(path)) {
      const b = req.postDataJSON() as {
        from: {
          type: string
          walletId?: string
          investmentId?: string
          quantity?: string
          unitPrice?: string
        }
        to: {
          type: string
          walletId?: string
          investmentId?: string
          quantity?: string
          unitPrice?: string
        }
      }
      const trade = b.from.type === 'INVESTMENT' ? b.from : b.to.type === 'INVESTMENT' ? b.to : null
      if (trade) {
        const inv = state.investments.find((x) => x.id === trade.investmentId)
        if (!inv) return json(404, envelope('NOT_FOUND'))
        const dq = Number(trade.quantity)
        const price = Number(trade.unitPrice)
        if (b.from.type === 'INVESTMENT') {
          if (dq > Number(inv.quantity)) return json(422, envelope('INSUFFICIENT_QUANTITY'))
          inv.quantity = String(Number(inv.quantity) - dq)
        } else {
          const q = Number(inv.quantity)
          inv.avgBuyPrice = String((q * Number(inv.avgBuyPrice) + dq * price) / (q + dq))
          inv.quantity = String(q + dq)
        }
        return json(201, { id: 't-trade' })
      }
    }

    const cats = /^\/spaces\/([^/]+)\/categories(?:\/([^/]+))?$/.exec(path)
    if (cats) {
      const id = cats[2]
      const view = (c: FakeCategory, stats: boolean) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sortOrder,
        ...(c.budgetAmount ? { budgetAmount: c.budgetAmount, budgetCurrency: 'IDR' } : {}),
        ...(stats
          ? {
              stats: {
                currency: 'IDR',
                spent: String(c.spent),
                ...(c.budgetAmount
                  ? {
                      budgetRemaining: String(Number(c.budgetAmount) - c.spent),
                      budgetUsedPct: ((c.spent / Number(c.budgetAmount)) * 100).toFixed(2),
                    }
                  : {}),
              },
            }
          : {}),
      })
      if (!id && req.method() === 'GET') {
        const url = new URL(req.url())
        const type = url.searchParams.get('type')
        const stats = url.searchParams.get('includeStats') === 'true'
        return json(
          200,
          state.categories.filter((c) => !type || c.type === type).map((c) => view(c, stats)),
        )
      }
      if (!id && req.method() === 'POST') {
        const b = req.postDataJSON() as Partial<FakeCategory>
        if (state.categories.some((c) => c.name === b.name && c.type === b.type))
          return json(409, envelope('CATEGORY_NAME_TAKEN'))
        const c: FakeCategory = {
          id: `c-${state.categories.length + 1}`,
          name: b.name ?? '',
          type: b.type ?? 'EXPENSE',
          icon: b.icon ?? '🏷️',
          color: b.color ?? PALETTE[0],
          sortOrder: state.categories.length,
          spent: 0,
          ...(b.budgetAmount ? { budgetAmount: b.budgetAmount } : {}),
        }
        state.categories.push(c)
        return json(201, view(c, false))
      }
    }
    if (req.method() === 'GET' && path === '/categories/suggestions') {
      return json(200, ['Coffee', 'Groceries'])
    }
    if (req.method() === 'GET' && path === '/wallet-card-presets') {
      return json(200, [
        { id: 'ocean', name: 'Ocean', colors: [PALETTE[8], PALETTE[9]], direction: 'E' },
      ])
    }
    if (req.method() === 'GET' && path === '/wallet-card-templates') {
      return json(200, [
        { id: 'classic', name: 'Classic' },
        { id: 'marble', name: 'Marble' },
      ])
    }

    switch (`${req.method()} ${path}`) {
      case 'GET /spaces':
        return json(200, spaces)
      case 'GET /currencies':
        return json(200, currencies)
      case 'GET /me/preferences':
        return json(200, state.preferences)
      case 'PATCH /me/preferences':
        state.preferences = { ...state.preferences, ...(req.postDataJSON() as object) }
        return json(200, state.preferences)
      case 'POST /me/app-lock/verify': {
        const { pin } = req.postDataJSON() as { pin: string }
        if (pin === '1234') return json(200, { valid: true })
        state.wrongPins++
        return state.wrongPins > 5
          ? json(429, envelope('APP_LOCK_TEMPORARILY_LOCKED', '', { retryAfter: 287 }))
          : json(200, { valid: false })
      }
      case 'POST /auth/refresh':
        state.calls.refresh++
        return state.signedIn ? json(200, auth) : json(401, envelope('REFRESH_TOKEN_INVALID'))
      case 'GET /me':
        return state.signedIn ? json(200, user) : json(401, envelope('UNAUTHENTICATED'))
      case 'POST /auth/register':
        state.signedIn = true
        return json(201, auth)
      case 'POST /auth/login': {
        const body = req.postDataJSON() as { password?: string }
        if (body.password !== 'correct horse') return json(401, envelope('INVALID_CREDENTIALS'))
        state.signedIn = true
        return json(200, auth)
      }
      case 'POST /auth/logout':
        state.signedIn = false
        return route.fulfill({ status: 204 })
      case 'POST /auth/forgot-password':
        return json(200, { message: 'ok' })
      default:
        return json(404, envelope('NOT_FOUND', `no fake for ${req.method()} ${path}`))
    }
  })

  return state
}
