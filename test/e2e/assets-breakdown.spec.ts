// Local-only (e2e is not run in CI).
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

test('assets page lists wallets and investments with balances', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  api.wallets.push({
    id: 'w-1',
    name: 'Cash',
    icon: '💵',
    type: 'CASH',
    currency: 'IDR',
    balance: '1000000',
    sortOrder: 0,
    isFavorite: false,
    cardStyle: { mode: 'SOLID', color: 'var(--accent)' },
  })
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
    price: '150',
    wrapper: 'Binance',
    participants: [],
  })
  await page.goto('/s/s-1/assets')
  await expect(page.getByRole('region', { name: 'Cash' }).getByText('Cash').first()).toBeVisible()
  const inv = page.getByRole('region', { name: 'Investments' })
  await expect(inv.getByText('Bitcoin')).toBeVisible()
  await expect(inv.getByTestId('row-pl')).toBeVisible()
})
