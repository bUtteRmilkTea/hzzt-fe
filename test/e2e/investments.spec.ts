// biome-ignore-all lint/plugin: fixture colours only
import { expect, test } from '@playwright/test'
import { type FakeApi, installFakeApi } from './fakeApi'

const seed = (api: FakeApi) => {
  api.wallets.push({
    id: 'w-1',
    name: 'Cash',
    icon: '💵',
    type: 'CASH',
    currency: 'IDR',
    balance: '1000000',
    sortOrder: 0,
    isFavorite: false,
    cardStyle: { mode: 'SOLID', color: '#34c759' },
  })
}

test('create a crypto holding with auto price, then buy and sell', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  await page.goto('/s/s-1/investments/new')
  await page.getByLabel('Type').selectOption('CRYPTO')
  await page.getByRole('radio', { name: 'Auto' }).click()
  await page.getByLabel('Search coins').fill('btc')
  await page.getByRole('button', { name: /BTC.*Bitcoin/ }).click()
  await page.getByLabel('Quantity', { exact: true }).fill('2')
  await page.getByLabel('Average buy price').fill('100')
  await page.getByRole('button', { name: 'Add investment' }).click()

  await expect(page).toHaveURL(/\/investments\/i-1$/)
  await expect(page.getByText('Bitcoin').first()).toBeVisible()

  await page.getByRole('button', { name: /^Buy$/ }).click()
  let sheet = page.getByRole('dialog', { name: /Buy/ })
  await sheet.getByLabel('Quantity', { exact: true }).fill('2')
  await sheet.getByLabel(/Unit price/).fill('200')
  await expect(sheet.getByTestId('trade-preview')).toContainText('$150.00') // new average
  await sheet.getByRole('button', { name: 'Buy' }).click()
  await expect(page.getByText('4').first()).toBeVisible() // quantity now 4

  await page.getByRole('button', { name: /^Sell$/ }).click()
  sheet = page.getByRole('dialog', { name: /Sell/ })
  await sheet.getByLabel('Quantity', { exact: true }).fill('10')
  await sheet.getByLabel(/Unit price/).fill('200')
  await sheet.getByRole('button', { name: 'Sell' }).click()
  await expect(sheet.getByRole('alert')).toContainText(
    "You don't hold enough to sell that quantity.",
  )
})

test('Auto mode needs an instrument; Indonesian stocks have no Auto tab; lots show derived shares', async ({
  page,
}) => {
  await installFakeApi(page, { signedIn: true })
  await page.goto('/s/s-1/investments/new')
  await page.getByLabel('Type').selectOption('CRYPTO')
  await page.getByRole('radio', { name: 'Auto' }).click()
  await page.getByLabel('Name').fill('Bitcoin')
  await page.getByLabel('Quantity', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Add investment' }).click()
  await expect(
    page.getByText('Search and choose an instrument for automatic pricing.'),
  ).toBeVisible()

  await page.getByLabel('Type').selectOption('ID_STOCK')
  await expect(page.getByRole('radio', { name: 'Auto' })).toBeDisabled()
  await page.getByLabel('Lots').fill('2')
  await expect(page.getByTestId('derived-shares')).toContainText('= 200 shares')
})

test('share 50/50: 99.99% is blocked, exactly 100.00% saves', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  api.investments.push({
    id: 'i-1',
    name: 'Bitcoin',
    symbol: 'BTC',
    icon: '🪙',
    assetType: 'CRYPTO',
    priceMode: 'MANUAL',
    quoteCurrency: 'USD',
    quantity: '1',
    avgBuyPrice: '100',
    price: '100',
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
  })
  await page.goto('/s/s-1/investments/i-1/sharing')
  await page.getByRole('button', { name: /Add person/ }).click()
  await page.getByLabel('Name').last().fill('Bob')
  await page.getByLabel('Jane share percent').fill('50')
  await page.getByLabel('Bob share percent').fill('49.99')
  await expect(page.getByTestId('share-total')).toContainText('99.99%')
  await expect(page.getByRole('button', { name: 'Save sharing' })).toBeDisabled()
  await page.getByLabel('Bob share percent').fill('50')
  await expect(page.getByTestId('share-total')).toContainText('100.00%')
  await page.getByRole('button', { name: 'Save sharing' }).click()
  await expect.poll(() => api.investments[0]?.participants.length).toBe(2)
  // S1: no redirect after saving; rows and toast stay (local-only, e2e does not run in CI).
  await expect(page.getByText('Sharing saved')).toBeVisible()
  await expect(page).toHaveURL(/\/investments\/i-1\/sharing$/)
  await expect(page.getByLabel('Bob share percent')).toHaveValue('50')
})

test('portfolio list shows the server totals and an empty state', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  await page.goto('/s/s-1/investments')
  await expect(page.getByText('No investments yet')).toBeVisible()
  api.investments.push({
    id: 'i-1',
    name: 'Bitcoin',
    symbol: 'BTC',
    icon: '🪙',
    assetType: 'CRYPTO',
    priceMode: 'MANUAL',
    quoteCurrency: 'USD',
    quantity: '2',
    avgBuyPrice: '100',
    price: '150',
    participants: [],
  })
  await page.reload()
  await expect(page.getByRole('region', { name: 'Crypto' }).getByText('Bitcoin')).toBeVisible()
  await expect(page.getByTestId('portfolio-summary')).toContainText('$300.00')
})
