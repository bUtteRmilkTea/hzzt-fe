// biome-ignore-all lint/plugin: fixture colours only
// Local-only (e2e is not run in CI). F18: Add returns to where it started, goals button, Sign out.
import { expect, test } from '@playwright/test'
import { type FakeApi, installFakeApi } from './fakeApi'

const seed = (api: FakeApi) => {
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

const goal = (n: number) => ({
  id: `g-${n}`,
  name: `Goal ${n}`,
  icon: '🎯',
  currency: 'IDR',
  targetAmount: '2000000',
  reserves: { 'w-1': 100000 * n },
})

for (const vp of [
  { width: 1440, height: 900 },
  { width: 360, height: 780 },
]) {
  test.describe(`Add then Cancel stays on the same page (${vp.width}px)`, () => {
    test.beforeEach(async ({ page }) => {
      seed(await installFakeApi(page, { signedIn: true }))
      await page.setViewportSize(vp)
    })

    const cases: Array<[string, string]> = [
      ['Home with its query', '/s/s-1?range=3M'],
      ['History with filters', '/s/s-1/history?period=month'],
      ['Wallets', '/s/s-1/wallets'],
      ['Assets', '/s/s-1/assets'],
      ['Settings', '/settings'],
    ]
    for (const [name, path] of cases) {
      test(name, async ({ page }) => {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const before = new URL(page.url())
        await page.getByRole('button', { name: 'Add transaction' }).click()
        await expect(page.getByRole('dialog', { name: 'Add transaction' })).toBeVisible()
        await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        const after = new URL(page.url())
        expect(after.pathname).toBe(before.pathname)
        expect(after.search).toBe(before.search)
      })
    }

    test('Escape also returns to the same page', async ({ page }) => {
      await page.goto('/s/s-1/assets')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Add transaction' }).click()
      await expect(page.getByRole('dialog', { name: 'Add transaction' })).toBeVisible()
      await page.waitForTimeout(400)
      await page.keyboard.press('Escape')
      await expect(page).toHaveURL(/\/s\/s-1\/assets$/)
    })
  })
}

test('a tampered returnTo is ignored', async ({ page }) => {
  seed(await installFakeApi(page, { signedIn: true }))
  for (const bad of ['https://evil.example', '//evil.example', '/s/x?next=//evil.example']) {
    await page.goto(`/s/s-1/transactions/new?type=EXPENSE&returnTo=${encodeURIComponent(bad)}`)
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL(/\/s\/s-1\/history/)
  }
})

test.describe('Home goals button', () => {
  for (const [n, shows] of [
    [1, false],
    [3, false],
    [4, true],
  ] as const) {
    test(`${n} active goal(s): View more ${shows ? 'shows' : 'is hidden'}, View all never shows`, async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      seed(api)
      for (let i = 1; i <= n; i++) api.goals.push(goal(i))
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/s/s-1')
      await expect(page.getByTestId('goals-list')).toBeVisible()
      await expect(page.getByTestId('goals-list').getByRole('listitem')).toHaveCount(Math.min(n, 3))
      await expect(page.getByRole('link', { name: 'View more' })).toHaveCount(shows ? 1 : 0)
      await expect(page.getByRole('link', { name: 'View all' })).toHaveCount(0)
      if (shows) {
        await page.getByRole('link', { name: 'View more' }).click()
        await expect(page).toHaveURL(/\/s\/s-1\/goals$/)
      }
    })
  }
})

test('Sign out lives in Settings, ends the session and lands on Login; Profile has none', async ({
  page,
}) => {
  seed(await installFakeApi(page, { signedIn: true }))
  await page.goto('/settings/profile')
  await expect(page.getByLabel(/email/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
})
