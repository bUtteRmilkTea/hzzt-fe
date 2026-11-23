// Local-only (e2e is not run in CI). F39: the growth chart on Assets and Investments.
import { expect, type Page, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

for (const vp of [
  { w: 1440, h: 900, touch: false },
  { w: 390, h: 844, touch: true },
]) {
  test.describe(`${vp.w}px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch })

    test('Assets: a rising series is positive, switching series keeps the page, notes show', async ({
      page,
    }) => {
      await installFakeApi(page, { signedIn: true })
      let history = 0
      page.on('request', (r) => {
        if (/net-worth\/history/.test(r.url())) history++
      })
      await page.goto('/s/s-1/assets')
      const chart = page.getByTestId('networth-growth')
      await expect(chart.getByTestId('growth-sentence')).toHaveText('Rising over the last month')
      await expect(chart.locator('svg[data-trend="up"]')).toBeVisible()
      await expect(chart.locator('path.stroke-up').first()).toBeAttached()
      const seen = history
      await chart.getByRole('radio', { name: 'Investments' }).click()
      await chart.getByRole('radio', { name: 'All assets' }).click()
      await expect(chart.getByTestId('growth-contributions')).toContainText('was added by you')
      expect(history).toBe(seen) // a series switch is not a request
      await chart.getByRole('radio', { name: 'YTD' }).click()
      await expect.poll(() => history).toBeGreaterThan(seen)
      expect(await noOverflow(page)).toBe(true)
    })

    test('Investments: a falling series is negative and the chart can be inspected', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      api.growth.falling = true
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
        participants: [],
      })
      await page.goto('/s/s-1/investments')
      const chart = page.getByTestId('portfolio-line')
      await expect(chart.getByTestId('growth-sentence')).toHaveText('Falling over the last month')
      await expect(chart.locator('svg[data-trend="down"]')).toBeVisible()
      await expect(chart.locator('path.stroke-down').first()).toBeAttached()
      await page.waitForTimeout(1200)
      const box = (await chart.locator('figure').boundingBox()) as {
        x: number
        y: number
        width: number
        height: number
      }
      if (vp.touch) {
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
      } else {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      }
      await expect(chart.getByTestId('chart-tooltip')).toBeVisible()
      expect(await noOverflow(page)).toBe(true)
    })
  })
}
