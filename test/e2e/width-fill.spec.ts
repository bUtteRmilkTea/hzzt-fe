// biome-ignore-all lint/plugin: fixture colours only
// Local-only (e2e is not run in CI). F19: Settings, Edit wallet and Wallet detail fill the width.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const PAGES: Array<[string, string]> = [
  ['Settings', '/settings'],
  ['Profile', '/settings/profile'],
  ['Space', '/settings/space'],
  ['Security', '/settings/security'],
  ['Currency', '/settings/currency'],
  ['Edit wallet', '/s/s-1/wallets/w-1/edit'],
  ['Wallet detail', '/s/s-1/wallets/w-1'],
]

async function setup(page: import('@playwright/test').Page) {
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
    cardStyle: { mode: 'SOLID', color: '#34c759' },
  })
}

/** How far the bordered blocks (cards, groups, fields) reach inside the page container. */
const reach = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const main = document.querySelector('main') as HTMLElement
    const box = (main.firstElementChild as HTMLElement).getBoundingClientRect()
    let minLeft = Number.POSITIVE_INFINITY
    let maxRight = 0
    for (const el of main.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width < 40 || r.height < 20) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || el.closest('.sr-only')) continue
      const bordered =
        Number.parseFloat(cs.borderTopWidth) > 0 || Number.parseFloat(cs.borderBottomWidth) > 0
      const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundImage !== 'none'
      if (!bordered && !filled) continue
      minLeft = Math.min(minLeft, r.left)
      maxRight = Math.max(maxRight, r.right)
    }
    return {
      containerLeft: box.left,
      containerRight: box.right,
      minLeft,
      maxRight,
      width: box.width,
    }
  })

for (const width of [1440, 1920]) {
  test.describe(`${width}px: the content reaches both sides`, () => {
    for (const [name, path] of PAGES) {
      test(name, async ({ page }) => {
        await setup(page)
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)
        const r = await reach(page)
        expect(r.width).toBeGreaterThan(width === 1440 ? 1000 : 1400)
        // Cards start at the left edge of the page container and end within 48px of the right edge.
        expect(r.minLeft - r.containerLeft).toBeLessThanOrEqual(16)
        expect(r.containerRight - r.maxRight).toBeLessThanOrEqual(48)
      })
    }
  })
}

test.describe('360px: nothing overflows', () => {
  for (const [name, path] of PAGES) {
    test(name, async ({ page }) => {
      await setup(page)
      await page.setViewportSize({ width: 360, height: 780 })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})

test('Edit wallet: the preview card follows what is typed', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1/wallets/w-1/edit')
  const preview = page.getByTestId('wallet-preview')
  await expect(preview).toContainText('Cash')
  await page.getByLabel('Name', { exact: true }).fill('Holiday fund')
  await expect(preview).toContainText('Holiday fund')
  // The preview sits to the right of the form.
  const form = await page.getByLabel('Name', { exact: true }).boundingBox()
  const pv = await preview.boundingBox()
  expect((pv?.x ?? 0) > (form?.x ?? 0) + (form?.width ?? 0)).toBe(true)
})

test('Wallet detail: transactions and the details column sit side by side from 1280px', async ({
  page,
}) => {
  await setup(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1/wallets/w-1')
  const side = await page.getByTestId('wallet-side').boundingBox()
  const txns = await page.getByRole('heading', { name: 'Transactions', exact: true }).boundingBox()
  expect((side?.x ?? 0) > (txns?.x ?? 0) + 300).toBe(true)
})
