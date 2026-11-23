// Local-only (e2e is not run in CI). F36: All goals link on Home, compact goals layout.
import { expect, type Page, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

async function seed(page: Page, n: number) {
  const api = await installFakeApi(page, { signedIn: true })
  api.wallets.push({
    id: 'w-1',
    name: 'Cash',
    icon: '💵',
    type: 'CASH',
    currency: 'IDR',
    balance: '100000000',
    sortOrder: 0,
    isFavorite: false,
    cardStyle: { mode: 'SOLID', color: 'var(--accent)' },
  })
  for (let i = 1; i <= n; i++) {
    api.goals.push({
      id: `g-${i}`,
      name: `Goal ${i}`,
      icon: '🎯',
      currency: 'IDR',
      targetAmount: '1000000',
      reserves: { 'w-1': 100000 * i },
    })
  }
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

for (const vp of [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
]) {
  test.describe(`${vp.w}px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } })

    for (const n of [1, 3, 5]) {
      test(`Home with ${n} goal(s): All goals link works, compact rows, no overflow`, async ({
        page,
      }) => {
        await seed(page, n)
        await page.goto('/s/s-1')
        const card = page.getByRole('region', { name: 'Goals' })
        await expect(card.getByTestId('goals-list')).toBeVisible()
        await expect(card.getByRole('listitem')).toHaveCount(Math.min(n, 3))
        const rows = await card.getByRole('listitem').all()
        for (const r of rows) {
          const b = await r.boundingBox()
          expect(b?.height ?? 999).toBeLessThanOrEqual(72)
        }
        expect(await noOverflow(page)).toBe(true)
        await card.getByRole('link', { name: /All goals/ }).click()
        await expect(page).toHaveURL(/\/s\/s-1\/goals$/)
      })

      test(`Goals page with ${n} goal(s): no tall blank area, no overflow`, async ({ page }) => {
        await seed(page, n)
        await page.goto('/s/s-1/goals')
        const cards = page.getByTestId('goals-grid').first().getByRole('listitem')
        await expect(cards).toHaveCount(n)
        await page.waitForTimeout(1200) // the entrance stagger moves cards while it runs
        const heights: number[] = []
        for (const c of await cards.all()) heights.push((await c.boundingBox())?.height ?? 0)
        const sorted = [...heights].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)] as number
        expect(Math.max(...heights)).toBeLessThanOrEqual(median * 1.5)
        if (vp.w >= 1280 && n >= 3) {
          // Three cards share one row on desktop.
          const tops = new Set(
            await Promise.all(
              (await cards.all()).slice(0, 3).map(async (c) => (await c.boundingBox())?.y),
            ),
          )
          expect(tops.size).toBe(1)
        }
        expect(await noOverflow(page)).toBe(true)
      })
    }
  })
}
