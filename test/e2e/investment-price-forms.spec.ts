// Local-only (e2e is not run in CI). F34: Auto by default, the total follows the live price, honest forms.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

for (const vp of [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
]) {
  test.describe(`${vp.w}px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } })

    test('a crypto holding starts as Auto, and its total follows the fake CMC price', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      api.cmc.BTC = '100'
      await page.goto('/s/s-1/investments/new')
      await page.getByLabel('Type').selectOption('CRYPTO')
      await expect(page.getByRole('radio', { name: 'Auto' })).toBeChecked()
      await page.getByLabel('Search coins').fill('btc')
      await page.getByRole('button', { name: /BTC.*Bitcoin/ }).click()
      await page.getByLabel('Quantity', { exact: true }).fill('2')
      await page.getByLabel('Average buy price').fill('90')
      await page.getByRole('button', { name: 'Add investment' }).click()
      await expect(page).toHaveURL(/\/investments\/i-1$/)
      await expect(page.getByTestId('price-source')).toContainText('Live price')
      await expect(page.getByTestId('valuation')).toContainText('$200.00')

      api.cmc.BTC = '250' // the fake exchange moves
      await page.goto('/s/s-1/investments')
      await expect(page.getByTestId('portfolio-summary')).toContainText('$500.00')
      await expect(page.getByTestId('typed-price-note')).toHaveCount(0)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
    })

    test('a typed price is labelled, counted in the note, and the manual value disables the price', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      api.investments.push({
        id: 'i-9',
        name: 'Ether',
        symbol: 'ETH',
        icon: '🪙',
        assetType: 'CRYPTO',
        priceMode: 'MANUAL',
        quoteCurrency: 'USD',
        quantity: '1',
        avgBuyPrice: '100',
        price: '150',
        participants: [],
      })
      await page.goto('/s/s-1/investments')
      await expect(page.getByTestId('typed-price-note')).toContainText(
        '1 of 1 holding uses a typed price',
      )
      await expect(page.getByTestId('price-source').first()).toHaveText('Typed price')

      await page.goto('/s/s-1/investments/new')
      await page.getByRole('radio', { name: 'Manual' }).click()
      await expect(page.getByLabel(/Expected yearly change/)).toHaveCount(0)
      const avg = page.getByLabel('Average buy price')
      await expect(avg.locator('xpath=..').getByTestId('input-prefix')).toHaveText('$')
      await page.getByLabel('Manual current value (optional)').fill('500')
      await expect(page.getByLabel('Current price')).toBeDisabled()
      await expect(page.getByText('Manual value overrides price × quantity.')).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
    })
  })
}
