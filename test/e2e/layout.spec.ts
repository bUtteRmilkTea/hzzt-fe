// Local-only (e2e is not run in CI). Layout checks at three viewports.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '390x844', width: 390, height: 844 },
] as const

const PAGES = ['/s/s-1', '/s/s-1/categories', '/s/s-1/goals', '/settings']

for (const vp of VIEWPORTS) {
  for (const path of PAGES) {
    test(`no horizontal scroll at ${vp.name} on ${path}`, async ({ page }) => {
      await installFakeApi(page, { signedIn: true })
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
}

test('home uses a multi-column grid at 1440 and one column at 390', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1')
  const grid = page.getByTestId('home-grid')
  await expect(grid).toBeVisible()
  const box = await grid.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(900)
  const cols = await grid.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
  )
  expect(cols).toBe(12)

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileCols = await grid.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
  )
  expect(mobileCols).toBe(1)
})
