// Local-only (e2e is not run in CI). R7 and R11: one exchange question, no expected change, no staked field.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const TYPES = ['CRYPTO', 'ID_STOCK', 'US_STOCK', 'GLOBAL_ETF', 'MUTUAL_FUND']

for (const width of [1440, 390]) {
  test(`${width}px: every asset type asks the exchange once and has no expected change or staked field`, async ({
    page,
  }) => {
    await installFakeApi(page, { signedIn: true })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/s/s-1/investments/new')
    for (const t of TYPES) {
      await page.getByLabel('Type').selectOption(t)
      await expect(page.getByLabel(/Exchange, broker or platform/)).toHaveCount(1)
      await expect(page.getByLabel(/Expected yearly change/)).toHaveCount(0)
      await expect(page.getByLabel(/Staked/)).toHaveCount(0)
      await expect(page.getByLabel(/^(Exchange or wallet|Broker|Platform)/)).toHaveCount(0)
    }
  })
}

test('the wrapper typed once is sent and the holding lands in that group', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  await page.goto('/s/s-1/investments/new')
  await page.getByLabel('Type').selectOption('CRYPTO')
  await page.getByRole('radio', { name: 'Manual' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Bitcoin')
  await page.getByLabel('Symbol', { exact: true }).fill('BTC')
  await page.getByLabel('Quantity', { exact: true }).fill('1')
  await page.getByLabel('Exchange, broker or platform (optional)').selectOption('__new__')
  await page.getByLabel('Name', { exact: true }).last().fill('Binance')
  await page.getByRole('button', { name: 'Add investment' }).click()
  await expect(page).toHaveURL(/\/investments\/i-1$/)
  expect(api.investments[0]?.wrapper).toBe('Binance')
})
