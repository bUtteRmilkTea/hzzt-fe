// Local-only (e2e is not run in CI). F14: the pages fill the screen and the numbers move.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

test('1920px: content fills the screen and cards share one gap', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  // Measure the resting layout: the staggered entry animation moves cards by a few px while it runs.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/s/s-1')
  const grid = page.getByTestId('home-grid')
  await expect(grid).toBeVisible()
  const box = await grid.boundingBox()
  // Sidebar is 240px; content should use nearly all the rest (max 1680px).
  expect(box?.width ?? 0).toBeGreaterThan(1500)
  const cards = await grid.locator('> div').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      }
    }),
  )
  // Hero row: net worth (8 cols) beside overview (4 cols), same top edge, 24px between them.
  expect(cards[0]?.y).toBe(cards[1]?.y)
  const gap = (cards[1]?.x ?? 0) - ((cards[0]?.x ?? 0) + (cards[0]?.w ?? 0))
  expect(gap).toBe(24)
})

test('headline numbers count up and the net worth line draws', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1')
  await expect(page.locator('[data-counting]').first()).toBeVisible()
  await expect(page.locator('.chart-line-draw').first()).toBeAttached()
  await expect(page.locator('[data-counting]')).toHaveCount(0, { timeout: 3000 }) // settled on the real values
})

test('reduced motion: nothing counts and nothing waits to appear', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/s/s-1')
  await expect(page.getByTestId('home-grid')).toBeVisible()
  await expect(page.locator('[data-counting]')).toHaveCount(0)
})

test('an interactive card lifts on hover', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1/goals')
  const card = page.locator('.card-interactive').first()
  if ((await card.count()) === 0) test.skip(true, 'no goals in the fake API')
  const before = await card.boundingBox()
  await card.hover()
  await page.waitForTimeout(350)
  const after = await card.boundingBox()
  expect((after?.y ?? 0) < (before?.y ?? 0)).toBe(true)
})
