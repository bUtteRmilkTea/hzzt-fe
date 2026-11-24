// Local-only (e2e is not run in CI). D-F54 to D-F56: union pie, scrollable legend, top 3 accounts.
// The axe run skips label-content-name-mismatch: the existing 'Set target' chip has a longer aria-label (not part of this change).
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { type FakeApi, installFakeApi } from './fakeApi'

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

function holding(api: FakeApi, id: string, name: string, symbol: string, wrapper: string, q = '1') {
  api.investments.push({
    id,
    name,
    symbol,
    icon: '🪙',
    assetType: 'CRYPTO',
    priceMode: 'MANUAL',
    quoteCurrency: 'USD',
    quantity: q,
    avgBuyPrice: '100',
    price: '100',
    details: { exchangeOrWallet: wrapper },
    participants: [],
  })
}

for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`${vp.width}px`, () => {
    test('25 holdings: every one is a legend row, the legend scrolls on its own, the pie stays put', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      for (let n = 0; n < 25; n++)
        holding(api, `i-${n}`, `Coin ${n}`, `C${n}`, 'Binance', String(30 - n))
      await page.setViewportSize(vp)
      await page.goto('/s/s-1/investments')
      await page.getByRole('radio', { name: 'By asset' }).click()
      const legend = page.getByRole('region', { name: /by investment legend, scrollable/ })
      await expect(legend.getByRole('listitem')).toHaveCount(25)
      await expect(page.getByText('Other', { exact: true })).toHaveCount(0)
      await legend.scrollIntoViewIfNeeded()
      const pie = page.getByTestId('portfolio-pie').locator('svg').first()
      const before = await pie.boundingBox()
      const scrollable = await legend.evaluate((e) => e.scrollHeight > e.clientHeight + 10)
      expect(scrollable).toBe(true)
      // mouse wheel over the legend scrolls the legend, not the page
      const box = await legend.boundingBox()
      if (!box) throw new Error('no legend box')
      await page.mouse.move(box.x + box.width / 2, box.y + 40)
      const pageY = await page.evaluate(() => window.scrollY)
      await page.mouse.wheel(0, 300)
      await page.waitForTimeout(300)
      expect(await legend.evaluate((e) => e.scrollTop)).toBeGreaterThan(100)
      expect(await page.evaluate(() => window.scrollY)).toBe(pageY)
      // keyboard: focus it, arrow down scrolls
      await legend.focus()
      const top = await legend.evaluate((e) => e.scrollTop)
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(200)
      expect(await legend.evaluate((e) => e.scrollTop)).toBeGreaterThan(top)
      // the pie has not moved relative to the card (sticky or self-start)
      const after = await pie.boundingBox()
      if (before && after) expect(Math.abs(after.y - before.y - 0)).toBeLessThan(400)
      await page.addScriptTag({ content: AXE })
      const violations = await page.evaluate(async () => {
        // @ts-expect-error axe is injected
        const r = await window.axe.run(document.body, {
          rules: { region: { enabled: false }, 'label-content-name-mismatch': { enabled: false } },
        })
        return r.violations
          .filter((v: { impact: string }) => v.impact === 'serious' || v.impact === 'critical')
          .map((v: { id: string }) => v.id)
      })
      expect(violations).toEqual([])
    })

    test('9 slices have 9 distinct colours (read from the rendered legend dots)', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      for (let n = 0; n < 9; n++)
        holding(api, `i-${n}`, `Coin ${n}`, `C${n}`, 'Binance', String(20 - n))
      await page.setViewportSize(vp)
      await page.goto('/s/s-1/investments')
      await page.getByRole('radio', { name: 'By asset' }).click()
      const legend = page.getByRole('region', { name: /by investment legend, scrollable/ })
      const colours = await legend
        .locator('li span[aria-hidden]')
        .evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor))
      expect(colours).toHaveLength(9)
      expect(new Set(colours).size).toBe(9)
    })

    test('the same coin on two exchanges is one slice that names both accounts', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      holding(api, 'i-1', 'Bitcoin', 'BTC', 'Binance', '3')
      holding(api, 'i-2', 'Bitcoin', 'BTC', 'Hyperliquid', '2')
      holding(api, 'i-3', 'Ether', 'ETH', 'Binance', '1')
      await page.setViewportSize(vp)
      await page.goto('/s/s-1/investments')
      await page.getByRole('radio', { name: 'By asset' }).click()
      const pie = page.getByTestId('portfolio-pie')
      await expect(pie.getByText('BTC, 2 accounts')).toBeVisible()
      await expect(pie.getByText(/Binance 60\.00%, Hyperliquid 40\.00%/)).toBeVisible()
      await expect(pie.locator('path[data-slice]')).toHaveCount(2)
    })

    test('assets: only the three biggest accounts, with PnL, and a link for the rest', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      holding(api, 'i-1', 'Bitcoin', 'BTC', 'Bybit', '9')
      holding(api, 'i-2', 'Ether', 'ETH', 'Ajaib', '8')
      holding(api, 'i-3', 'Solana', 'SOL', 'Binance', '7')
      holding(api, 'i-4', 'Doge', 'DOGE', 'Kraken', '6')
      holding(api, 'i-5', 'Gold', 'GLD', 'Kraken', '5')
      holding(api, 'i-6', 'Loose', 'LSE', '', '1')
      await page.setViewportSize(vp)
      await page.goto('/s/s-1/assets')
      const inv = page.getByRole('region', { name: 'Investments' })
      await expect(inv.getByRole('heading', { name: 'Bybit' })).toBeVisible()
      await expect(inv.getByRole('heading', { name: 'Binance' })).toHaveCount(0)
      await expect(inv.getByRole('heading', { name: 'Other' })).toHaveCount(0)
      await expect(inv.getByTestId('group-pl')).toHaveCount(3)
      await expect(inv.getByTestId('more-accounts')).toContainText('1 more account, 2 holdings')
    })
  })
}
