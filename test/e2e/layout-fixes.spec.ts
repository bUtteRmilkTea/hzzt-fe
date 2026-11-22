// biome-ignore-all lint/plugin: fixture colours only
// Local-only (e2e is not run in CI). F15: dead space, goals on Home, Transfer cancel, Assets grouping.
import { expect, test } from '@playwright/test'
import { type FakeApi, installFakeApi } from './fakeApi'

const seed = (api: FakeApi) => {
  api.wallets.push(
    {
      id: 'w-1',
      name: 'Cash',
      icon: '💵',
      type: 'CASH',
      currency: 'IDR',
      balance: '1000000',
      sortOrder: 0,
      isFavorite: false,
      cardStyle: { mode: 'SOLID', color: '#34c759' },
    },
    {
      id: 'w-2',
      name: 'BCA',
      icon: '🏦',
      type: 'BANK',
      currency: 'IDR',
      balance: '500000',
      sortOrder: 1,
      isFavorite: false,
      cardStyle: { mode: 'SOLID', color: '#0a84ff' },
    },
  )
}

for (const vp of [
  { width: 1440, height: 900 },
  { width: 360, height: 780 },
]) {
  test(`Transfer from a wallet: cancel returns to that wallet, not History (${vp.width}px)`, async ({
    page,
  }) => {
    const api = await installFakeApi(page, { signedIn: true })
    seed(api)
    await page.setViewportSize(vp)
    await page.goto('/s/s-1/wallets/w-1')
    await page.getByRole('link', { name: 'Transfer' }).click()
    await expect(page).toHaveURL(/transactions\/new/)
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL(/\/s\/s-1\/wallets\/w-1$/)
  })
}

test('an external returnTo is ignored and cancel falls back to History', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  await page.goto('/s/s-1/transactions/new?type=TRANSFER&returnTo=https://evil.example/x')
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await expect(page).toHaveURL(/\/s\/s-1\/history/)
})

test('wallet detail: the card is capped and sits beside the details on desktop', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1/wallets/w-1')
  const card = page.locator('[data-tone]').first()
  await expect(card).toBeVisible()
  const box = await card.boundingBox()
  expect(box?.width ?? 0).toBeLessThanOrEqual(400)
  expect(box?.height ?? 0).toBeLessThanOrEqual(250)
  // The action buttons are to the right of the card, not below it.
  const add = await page.getByRole('button', { name: 'Add balance' }).boundingBox()
  expect((add?.x ?? 0) > (box?.x ?? 0) + (box?.width ?? 0)).toBe(true)
})

test('home shows goals with progress, and an empty state without any', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1')
  await expect(page.getByTestId('goals-empty')).toBeVisible()
  api.goals.push({
    id: 'g-1',
    name: 'Phone',
    icon: '📱',
    currency: 'IDR',
    targetAmount: '2000000',
    reserves: { 'w-1': 500000 },
  })
  await page.reload()
  const list = page.getByTestId('goals-list')
  await expect(list).toBeVisible()
  await expect(list).toContainText('Phone')
  await expect(list.getByRole('progressbar', { name: 'Goal progress' })).toHaveAttribute(
    'aria-valuenow',
    '25',
  )
})

test('assets: investments are grouped by broker or exchange, with totals', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  const base = {
    icon: '🪙',
    priceMode: 'MANUAL',
    quoteCurrency: 'USD',
    quantity: '1',
    avgBuyPrice: '100',
    price: '150',
    participants: [],
  }
  api.investments.push(
    { ...base, id: 'i-1', name: 'Bitcoin', symbol: 'BTC', assetType: 'CRYPTO', wrapper: 'Bybit' },
    { ...base, id: 'i-2', name: 'Ether', symbol: 'ETH', assetType: 'CRYPTO', wrapper: 'Bybit' },
    { ...base, id: 'i-3', name: 'Apple', symbol: 'AAPL', assetType: 'US_STOCK', wrapper: 'Ajaib' },
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/s/s-1/assets')
  const inv = page.getByRole('region', { name: 'Investments' })
  await expect(inv.getByRole('heading', { name: 'Bybit' })).toBeVisible()
  await expect(inv.getByRole('heading', { name: 'Ajaib' })).toBeVisible()
  await expect(inv.getByText('2 holdings')).toBeVisible()
})

test('history: dense rows, and a bigger donut in the summary rail', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  api.transactions.push({
    id: 't-1',
    walletId: 'w-1',
    type: 'EXPENSE',
    direction: 'OUT',
    amount: '25000',
    currency: 'IDR',
    title: 'Coffee',
    occurredAt: new Date().toISOString(),
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1/history')
  const row = page.getByRole('list', { name: 'Transactions' }).getByRole('link').first()
  await expect(row).toBeVisible()
  expect((await row.boundingBox())?.height ?? 99).toBeLessThanOrEqual(50)
  const rail = page.getByTestId('history-rail')
  await expect(rail).toBeVisible()
  const donut = rail.locator('svg[role="img"]').first()
  await expect(donut).toBeVisible()
  expect((await donut.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(220)
})

test('add investment: wide two-column layout with a filled summary rail', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1/investments/new')
  const rail = page.getByTestId('summary-rail')
  await expect(rail).toBeVisible()
  await expect(page.getByTestId('rail-recent')).toBeVisible()
  const form = await page.locator('form').first().boundingBox()
  const r = await rail.boundingBox()
  expect(form?.width ?? 0).toBeGreaterThan(600)
  expect(r?.width ?? 0).toBeGreaterThanOrEqual(380)
  // The two columns together use nearly all of the content width (no wide blank margins).
  const used = (r?.x ?? 0) + (r?.width ?? 0) - (form?.x ?? 0)
  expect(used).toBeGreaterThan(1000)
})
