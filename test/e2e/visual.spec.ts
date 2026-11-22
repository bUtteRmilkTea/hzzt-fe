// Local-only visual regression (e2e is not run in CI). Create/refresh baselines with
// `pnpm test:e2e:update`; runs on the desktop-1440, tablet-1024 and mobile-390 projects.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const PAGES = [
  ['home', '/s/s-1'],
  ['history', '/s/s-1/history'],
  ['wallets', '/s/s-1/wallets'],
  ['assets', '/s/s-1/assets'],
  ['investments', '/s/s-1/investments'],
  ['categories', '/s/s-1/categories'],
  ['goals', '/s/s-1/goals'],
] as const

for (const theme of ['dark', 'light'] as const) {
  for (const [name, path] of PAGES) {
    test(`${name} (${theme})`, async ({ page }) => {
      await installFakeApi(page, { signedIn: true })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('theme', t)
        } catch {
          // storage unavailable: the app falls back to its default theme
        }
      }, theme)
      await page.goto(path)
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveScreenshot(`${name}-${theme}.png`, { fullPage: true })
    })
  }
}

test('gallery renders both themes', async ({ page }) => {
  for (const theme of ['dark', 'light'] as const) {
    await page.goto('/_gallery')
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    await expect(page).toHaveScreenshot(`gallery-${theme}.png`, { fullPage: true })
  }
})
