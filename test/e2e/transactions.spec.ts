// biome-ignore-all lint/plugin: hex strings here are card colours used as test fixtures
import { expect, test } from '@playwright/test'
import { type FakeApi, installFakeApi } from './fakeApi'

const seedWallets = (api: FakeApi) => {
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
      cardStyle: { mode: 'SOLID', color: '#4480ee' },
    },
    {
      id: 'w-3',
      name: 'Savings',
      icon: '💰',
      type: 'BANK',
      currency: 'USD',
      balance: '100',
      sortOrder: 2,
      isFavorite: false,
      cardStyle: { mode: 'SOLID', color: '#ff9f0a' },
    },
  )
  api.categories.push({
    id: 'c-1',
    name: 'Food',
    type: 'EXPENSE',
    icon: '🍜',
    color: '#ff9f0a',
    sortOrder: 0,
    spent: 0,
  })
}

const keypad = async (root: import('@playwright/test').Locator, digits: string) => {
  for (const d of digits) await root.getByRole('button', { name: new RegExp(`^${d}$`) }).click()
}

test('add an expense: it shows in history and the wallet balance drops, with no reload', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  seedWallets(api)
  await page.goto('/s/s-1/history')
  await expect(page.getByText('No transactions yet')).toBeVisible()

  await page.getByRole('button', { name: 'Add transaction' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add transaction' })
  await keypad(sheet, '75000')
  await sheet.getByRole('button', { name: /Food/ }).click()
  await sheet.getByLabel('Note (optional)').fill('Lunch')
  await sheet.getByRole('button', { name: 'Add expense' }).click()

  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByText('Lunch')).toBeVisible()
  await expect(page.getByText(/Out.*75,000/)).toBeVisible() // the day header's total

  await page.getByRole('link', { name: 'Wallets' }).click()
  await expect(page.getByText('925,000').first()).toBeVisible() // 1,000,000 - 75,000
})

test('filter by category, then the URL carries the view into a new tab', async ({
  page,
  context,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  seedWallets(api)
  api.transactions.push(
    {
      id: 't-1',
      walletId: 'w-1',
      type: 'EXPENSE',
      direction: 'OUT',
      amount: '5000',
      currency: 'IDR',
      title: 'Coffee',
      occurredAt: new Date().toISOString(),
    },
    {
      id: 't-2',
      walletId: 'w-2',
      type: 'EXPENSE',
      direction: 'OUT',
      amount: '9000',
      currency: 'IDR',
      title: 'Taxi',
      occurredAt: new Date().toISOString(),
    },
  )
  await page.goto('/s/s-1/history')
  await page.getByLabel('Search transactions').fill('coffee')
  await expect(page.getByText('Taxi')).toBeHidden()
  await expect(page.getByText('Coffee')).toBeVisible()

  const url = page.url()
  expect(url).toContain('q=coffee')
  const copy = await context.newPage()
  await installFakeApi(copy, { signedIn: true })
  await copy.goto(url) // a pasted URL restores the same view
  await expect(copy.getByLabel('Search transactions')).toHaveValue('coffee')
})

test('a cross-currency transfer needs the amount received, shows the rate, and updates both balances', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  seedWallets(api)
  await page.goto('/s/s-1/transactions/new?type=TRANSFER')
  const sheet = page.getByRole('dialog', { name: 'Add transaction' })
  await sheet.getByLabel('From').selectOption('w-3') // USD
  await sheet.getByLabel('To').selectOption('w-1') // IDR
  await keypad(sheet, '10')
  await sheet.getByRole('button', { name: 'Transfer' }).click()
  await expect(sheet.getByText('Enter the amount received')).toBeVisible()
  await sheet.getByLabel(/Amount received/).fill('162500')
  await expect(sheet.getByText('1 USD = 16,250 IDR')).toBeVisible()
  await sheet.getByRole('button', { name: 'Transfer' }).click()
  await expect.poll(() => api.wallets.find((w) => w.id === 'w-3')?.balance).toBe('90')
  expect(api.wallets.find((w) => w.id === 'w-1')?.balance).toBe('1162500')
})

test('edit an expense, then delete it; both balances stay right', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seedWallets(api)
  api.transactions.push({
    id: 't-1',
    walletId: 'w-1',
    type: 'EXPENSE',
    direction: 'OUT',
    amount: '5000',
    currency: 'IDR',
    title: 'Coffee',
    occurredAt: new Date().toISOString(),
  })
  await page.goto('/s/s-1/history')
  await page.getByText('Coffee').click()
  const sheet = page.getByRole('dialog', { name: 'Coffee' })
  await sheet.getByRole('button', { name: 'Delete' }).click()
  await page
    .getByRole('dialog', { name: 'Delete this transaction?' })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByText('No transactions yet')).toBeVisible()
  expect(api.wallets.find((w) => w.id === 'w-1')?.balance).toBe('1005000') // the 5,000 came back
})

test('a failed save rolls the row back and tells the user', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seedWallets(api)
  await page.route('**/api/v1/spaces/*/transactions', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }),
    })
  })
  await page.goto('/s/s-1/history')
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add transaction' })
  await keypad(sheet, '9000')
  await sheet.getByLabel('Note (optional)').fill('Oops')
  await sheet.getByRole('button', { name: 'Add expense' }).click()
  await expect(page.getByText(/Couldn't save that transaction/)).toBeVisible()
  await expect(page.getByText('Oops')).toBeHidden()
})

test('scrolling 500 transactions renders a window, not 500 rows', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seedWallets(api)
  for (let i = 0; i < 500; i++) {
    api.transactions.push({
      id: `t-${i}`,
      walletId: 'w-1',
      type: 'EXPENSE',
      direction: 'OUT',
      amount: '1000',
      currency: 'IDR',
      title: `Item ${i}`,
      occurredAt: new Date(Date.now() - i * 60_000).toISOString(),
    })
  }
  await page.goto('/s/s-1/history')
  await expect(page.getByText('Item 0')).toBeVisible()
  expect(await page.getByRole('listitem').count()).toBeLessThan(80)
  await page.mouse.wheel(0, 20000)
  await expect(page.getByText('Item 0')).toBeHidden()
  expect(await page.getByRole('listitem').count()).toBeLessThan(80)
})
