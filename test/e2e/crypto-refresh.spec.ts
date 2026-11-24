// Local-only (e2e is not run in CI). D-F57: the investments page picks up a new price after 15 minutes.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

for (const width of [1440, 390]) {
  test(`${width}px: the portfolio value follows a new price once the 15 minute interval passes`, async ({
    page,
  }) => {
    const api = await installFakeApi(page, { signedIn: true })
    api.investments.push({
      id: 'i-1',
      name: 'Bitcoin',
      symbol: 'BTC',
      icon: '🪙',
      assetType: 'CRYPTO',
      priceMode: 'AUTO',
      quoteCurrency: 'USD',
      quantity: '2',
      avgBuyPrice: '100',
      price: '100',
      participants: [],
    })
    await page.clock.install()
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/s/s-1/investments')
    const hero = page.getByTestId('portfolio-summary')
    await expect(hero).toContainText('$200.00')

    const btc = api.investments[0]
    if (!btc) throw new Error('no holding')
    btc.price = '150' // the server job has refreshed the CMC price
    await page.clock.runFor(14 * 60_000)
    await expect(hero).toContainText('$200.00') // not before the interval
    await page.clock.runFor(60_000 + 1000)
    await expect(hero).toContainText('$300.00')
  })
}
