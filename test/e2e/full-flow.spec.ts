// biome-ignore-all lint/plugin: fixture colours only
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

/**
 * The whole product in one pass: register -> wallet -> transactions -> investment -> goal -> dashboard.
 * By default the API is faked in the browser, so CI needs no backend. Point it at a real, freshly seeded
 * backend with E2E_REAL_API=1 (the dev server then proxies /api to API_PROXY_TARGET).
 */
const real = Boolean(process.env.E2E_REAL_API)

const keypad = async (root: import('@playwright/test').Locator, digits: string) => {
  for (const d of digits)
    await root
      .getByRole('button', { name: new RegExp(`^${d}$`) })
      .first()
      .click()
}

test('register, create a wallet, record spending, add an investment, set a goal, read the dashboard', async ({
  page,
}) => {
  const api = real ? null : await installFakeApi(page)
  api?.categories.push({
    id: 'c-1',
    name: 'Food',
    type: 'EXPENSE',
    icon: '🍜',
    color: '#ff9f0a',
    sortOrder: 0,
    spent: 0,
  })

  // 1. register
  await page.goto('/register')
  const email = real ? `e2e-${Date.now()}@example.com` : 'jane@example.com'
  await page.getByLabel('Name').fill('Jane')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('correct horse battery')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()

  // 2. a wallet with an opening balance
  await page.getByRole('link', { name: 'Wallets' }).click()
  await page.getByRole('button', { name: 'Add wallet' }).first().click()
  const wallet = page.getByRole('dialog', { name: 'Add wallet' })
  await wallet.getByLabel('Name').fill('Cash')
  await keypad(wallet, '1000000')
  await wallet.getByRole('button', { name: 'Add wallet' }).click()
  await expect(page).toHaveURL(/\/wallets\/[\w-]+$/)

  // 3. record spending
  await page.getByRole('button', { name: 'Add transaction' }).click()
  const txn = page.getByRole('dialog', { name: 'Add transaction' })
  await keypad(txn, '75000')
  await txn.getByRole('button', { name: /Food/ }).click()
  await txn.getByLabel('Note (optional)').fill('Lunch')
  await txn.getByRole('button', { name: 'Add expense' }).click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByText('Lunch')).toBeVisible()

  // 4. an investment, valued manually
  await page.goto(page.url().replace(/\/history.*$/, '/investments/new'))
  await page.getByLabel('Type').selectOption('CRYPTO')
  await page.getByLabel('Name').fill('Bitcoin')
  await page.getByLabel('Symbol').fill('BTC')
  await page.getByLabel('Quantity').fill('0.1')
  await page.getByLabel('Average buy price').fill('50000')
  await page.getByLabel('Current price').fill('60000')
  await page.getByRole('button', { name: 'Add investment' }).click()
  await expect(page).toHaveURL(/\/investments\/[\w-]+$/)
  await expect(page.getByTestId('valuation')).toBeVisible()

  // 5. a savings goal reserving part of the wallet
  await page.goto(page.url().replace(/\/investments.*$/, '/goals/new'))
  await page.getByLabel('Name').fill('Holiday')
  await keypad(page.locator('form'), '5000000')
  await page.getByLabel('From wallet').selectOption({ index: 1 })
  await keypad(page.locator('form'), '100000')
  await page.getByRole('button', { name: 'Add goal' }).click()
  await expect(page).toHaveURL(/\/goals\/[\w-]+$/)

  // 6. the dashboard reflects it all
  await page.goto(page.url().replace(/\/goals.*$/, ''))
  await expect(page.getByTestId('overview')).toBeVisible()
  await expect(page.getByTestId('overview')).toContainText('75,000')
  await expect(page.getByTestId('line-chart')).toBeVisible()
  await expect(page.getByTestId('bar-chart')).toBeVisible()
})
