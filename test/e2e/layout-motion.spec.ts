// F11 acceptance. Needs a browser: run locally with `pnpm test:e2e` (Chromium system libs required).
import { expect, test } from '@playwright/test'

test.describe('layout and motion foundation (F11)', () => {
  test('expanding one card leaves the card in the other column untouched', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/_gallery')
    const left = page.getByTestId('col-left-card')
    await left.scrollIntoViewIfNeeded()
    const before = await left.boundingBox()
    const rightBefore = await page.getByTestId('collapsible').boundingBox()

    await page.getByRole('button', { name: 'Expand' }).click()
    // Wait out the 220ms height transition.
    await expect
      .poll(async () => (await page.getByTestId('collapsible').boundingBox())?.height)
      .toBeGreaterThan(rightBefore?.height ?? 0)

    expect(await left.boundingBox()).toEqual(before)
  })

  test('stacks to one column at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await page.goto('/_gallery')
    const cols = page.getByTestId('two-column').locator('[data-column]')
    const [a, b] = await Promise.all([cols.nth(0).boundingBox(), cols.nth(1).boundingBox()])
    expect(b?.y).toBeGreaterThan((a?.y ?? 0) + (a?.height ?? 0) - 1)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)
  })

  test('hidden amounts show no digit in the gallery at several moments of the animation', async ({
    page,
  }) => {
    await page.goto('/_gallery')
    await page.getByRole('switch', { name: /Hide amounts/i }).click()
    for (const ms of [0, 100, 350, 800]) {
      await page.waitForTimeout(ms)
      const text = await page.getByRole('region', { name: 'Amounts' }).textContent()
      expect(text ?? '').not.toMatch(/\d/)
    }
  })
})
