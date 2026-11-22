// Local-only (e2e is not run in CI). F24: no visible page names, no blank band at the top.

import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const SCREENS = [
  { path: '/s/s-1', name: 'Home' },
  { path: '/s/s-1/assets', name: 'Assets' },
  { path: '/s/s-1/wallets', name: 'Wallets' },
  { path: '/s/s-1/investments', name: 'Investments' },
  { path: '/s/s-1/history', name: 'History' },
  { path: '/settings', name: 'Settings' },
]

for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`${vp.width}px`, () => {
    for (const s of SCREENS) {
      test(`${s.name}: the h1 is not drawn, but stays in the outline`, async ({ page }) => {
        await installFakeApi(page, { signedIn: true })
        await page.setViewportSize(vp)
        await page.goto(s.path)
        const h1 = page.getByRole('heading', { level: 1, name: s.name })
        await expect(h1).toHaveCount(1)
        const box = await h1.boundingBox()
        // sr-only collapses to 1px
        expect((box?.width ?? 0) <= 1).toBe(true)
      })
    }

    test('Profile: the back link still works and no title is drawn', async ({ page }) => {
      await installFakeApi(page, { signedIn: true })
      await page.setViewportSize(vp)
      await page.goto('/settings/profile')
      await expect(page.getByText('Profile', { exact: true })).toHaveCount(0)
      await page.getByRole('link', { name: 'Back to settings' }).click()
      await expect(page).toHaveURL(/\/settings$/)
    })

    test('Wallet detail keeps the wallet name', async ({ page }) => {
      const api = await installFakeApi(page, { signedIn: true })
      api.wallets.push({
        id: 'w-1',
        name: 'BCA',
        icon: '🏦',
        type: 'BANK',
        currency: 'IDR',
        balance: '0',
        sortOrder: 0,
        isFavorite: false,
      })
      await page.setViewportSize(vp)
      await page.goto('/s/s-1/wallets/w-1')
      const h1 = page.getByRole('heading', { level: 1, name: 'BCA' })
      await expect(h1).toBeVisible()
      expect((await h1.boundingBox())?.width ?? 0).toBeGreaterThan(8)
    })
  })
}
