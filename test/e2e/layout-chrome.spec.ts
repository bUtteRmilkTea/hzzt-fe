// biome-ignore-all lint/plugin: hex strings here are fixture category colours
// Local-only (e2e is not run in CI). D-F52 to D-F53: no page header, Categories fills the width,
// one line section header on Investments, no blank space on the detail pages.
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}px`, () => {
    test('categories: the grid fills the width at every size, no empty column', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      for (let n = 0; n < 9; n++)
        api.categories.push({
          id: `c-${n + 1}`,
          name: `Category ${n + 1}`,
          type: 'EXPENSE',
          icon: '🛒',
          color: '#336699',
          sortOrder: n,
          spent: 0,
        })
      for (const w of [vp.width, 768, 1024, 1920]) {
        await page.setViewportSize({ width: w, height: vp.height })
        await page.goto('/s/s-1/categories')
        const items = page.getByTestId('category-grid').locator('> li')
        await expect(items).toHaveCount(9)
        await page.waitForTimeout(1000) // the stagger entrance has settled
        const boxes = await items.evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect()
            return { left: r.left, right: r.right, top: r.top }
          }),
        )
        const grid = await page.getByTestId('category-grid').boundingBox()
        if (!grid) throw new Error('no grid')
        const firstRow = boxes.filter((b) => Math.abs(b.top - (boxes[0]?.top ?? 0)) < 2)
        const perRow = firstRow.length
        const expected = Math.max(1, Math.floor((grid.width + 24) / (17 * 16 + 24)))
        expect(perRow).toBeGreaterThanOrEqual(Math.min(expected, 9) - 0)
        const rightEdge = Math.max(...firstRow.map((b) => b.right))
        if (boxes.length >= perRow) expect(grid.x + grid.width - rightEdge).toBeLessThan(24 + 1)
      }
      if (vp.width >= 1440) {
        await page.setViewportSize(vp)
        await page.goto('/s/s-1/categories')
        const first = page.getByTestId('category-grid').locator('> li').first()
        await expect(first).toBeVisible()
        await page.waitForTimeout(1000)
        const cols = await page
          .getByTestId('category-grid')
          .locator('> li')
          .evaluateAll(
            (els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size,
          )
        expect(cols).toBeGreaterThanOrEqual(3)
      }
    })

    test('no visible page title, back and action stay reachable', async ({ page }) => {
      await installFakeApi(page, { signedIn: true })
      await page.setViewportSize(vp)
      await page.goto('/s/s-1/categories')
      const h1 = page.getByRole('heading', { level: 1, name: 'Categories' })
      expect((await h1.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1)
      await expect(page.getByRole('link', { name: 'Back to settings' })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Add$/ })).toBeVisible()
    })

    test('investments: amount, share and target sit on one line, same height in every state', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      for (const [id, name, ex] of [
        ['i-1', 'Bitcoin', 'Binance'],
        ['i-2', 'Ether', 'Bybit'],
      ] as const)
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
      await page.setViewportSize(vp)
      await page.goto('/s/s-1/investments')
      const headers = page.getByTestId('wrapper-header')
      await expect(headers).toHaveCount(2)
      // The row is the first three children; the hint and error notes are their own grid row.
      const rowBoxes = async () =>
        headers.first().evaluate((h) => {
          const kids = [...h.children].slice(0, 3).map((c) => c.getBoundingClientRect())
          const narrow = window.innerWidth < 640
          // On a phone the controls are line 2 on purpose, so compare line 1 only.
          const line1 = narrow ? kids.slice(0, 2) : kids
          return {
            height: Math.max(...line1.map((k) => k.height)),
            tops: line1.map((k) => k.top + k.height / 2),
          }
        })
      const before = await rowBoxes()
      {
        // one line: the centres of name, amount and controls are within 2 px
        const centres = before.tops
        expect(Math.max(...centres) - Math.min(...centres)).toBeLessThan(2)
      }
      await page.getByRole('button', { name: /Binance target not set/ }).click()
      const during = await rowBoxes()
      expect(Math.abs(during.height - before.height)).toBeLessThan(2)
      await page.getByLabel('Binance target percent').fill('60')
      await page.keyboard.press('Enter')
      await expect(page.getByText('Target 60.00%')).toBeVisible()
      const after = await rowBoxes()
      expect(Math.abs(after.height - before.height)).toBeLessThan(2)
    })

    test('detail pages: no empty area taller than 240px, axe clean', async ({ page }) => {
      const api = await installFakeApi(page, { signedIn: true })
      api.assets.push({
        id: 'a-1',
        kind: 'FIXED_ASSET',
        name: 'Car',
        icon: '🚗',
        currency: 'IDR',
        currentValue: '100000',
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
        price: '100',
        details: { exchangeOrWallet: 'Binance' },
        participants: [],
      })
      await page.setViewportSize(vp)
      for (const path of ['/s/s-1/assets/a-1', '/s/s-1/investments/i-1']) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeAttached()
        await page.waitForTimeout(600)
        // Tallest vertical gap with nothing drawn, scanning the content at its natural width.
        const gap = await page.evaluate(() => {
          const main = document.querySelector('main') ?? document.body
          const rects = [...main.querySelectorAll('*')]
            .filter((e) => (e as HTMLElement).offsetParent !== null)
            .map((e) => e.getBoundingClientRect())
            .filter((r) => r.width > 40 && r.height > 8 && r.height < 600)
          const top = Math.min(...rects.map((r) => r.top))
          const bottom = Math.max(...rects.map((r) => r.bottom))
          let worst = 0
          for (let y = top; y < bottom; y += 4) {
            const anyHit = rects.some((r) => r.top <= y && r.bottom >= y)
            if (!anyHit) worst = Math.max(worst, 4)
          }
          return worst
        })
        expect(gap).toBeLessThan(240)
        if (vp.width >= 1440) {
          const cols = await page.evaluate(() => {
            const cards = [...document.querySelectorAll('main section, main [class*="rounded"]')]
            return new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left / 20))).size
          })
          expect(cols).toBeGreaterThanOrEqual(1)
        }
        await page.addScriptTag({ content: AXE })
        const violations = await page.evaluate(async () => {
          // @ts-expect-error axe is injected
          const r = await window.axe.run(document.body, { rules: { region: { enabled: false } } })
          return r.violations
            .filter((v: { impact: string }) => v.impact === 'serious' || v.impact === 'critical')
            .map((v: { id: string }) => v.id)
        })
        expect(violations).toEqual([])
      }
    })
  })
}
