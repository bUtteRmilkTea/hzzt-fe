// Local-only (e2e is not run in CI).
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

test('desktop shows a category panel with wrapper sections and a pie per wrapper', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  for (const [id, name, ex] of [
    ['i-1', 'Bitcoin', 'Binance'],
    ['i-2', 'Ether', 'Bybit'],
  ] as const) {
    api.investments.push({
      id,
      name,
      symbol: name.slice(0, 3).toUpperCase(),
      icon: '🪙',
      assetType: 'CRYPTO',
      priceMode: 'MANUAL',
      quoteCurrency: 'USD',
      quantity: '1',
      avgBuyPrice: '100',
      price: '100',
      details: { exchangeOrWallet: ex },
      participants: [],
    })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1/investments')
  await expect(page.getByRole('region', { name: 'Crypto' })).toBeVisible()
  await expect(page.getByTestId('wrapper-section')).toHaveCount(2)
  await expect(page.getByTestId('pie-chart').first()).toBeVisible()
})

test('set a wrapper target inline and it survives a reload', async ({ page }) => {
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
    details: { exchangeOrWallet: 'Binance' },
    participants: [],
  })
  await page.goto('/s/s-1/investments')
  await page.getByRole('button', { name: /Binance target not set/ }).click()
  await page.getByLabel('Binance target percent').fill('60')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Target 60.00%')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Target 60.00%')).toBeVisible()
})
