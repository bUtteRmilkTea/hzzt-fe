// Local-only (e2e is not run in CI). F13: the add form on desktop and phone.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const sizes = [
  { name: '1280px', width: 1280, height: 800 },
  { name: '360px', width: 360, height: 780 },
] as const

for (const size of sizes) {
  test(`create an investment at ${size.name}`, async ({ page }) => {
    await installFakeApi(page, { signedIn: true })
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('/s/s-1/investments/new')
    await page.getByLabel('Type').selectOption('CRYPTO')
    await page.getByRole('radio', { name: 'Manual' }).click()

    // The Add button is on screen without scrolling.
    const add = page.getByRole('button', { name: 'Add investment' })
    await expect(add).toBeInViewport()

    // The emoji grid is hidden until the icon tile is opened.
    await expect(page.getByRole('button', { name: 'Emoji 💰' })).toHaveCount(0)
    await page.getByRole('button', { name: /^Icon: .*, change$/ }).click()
    await page.getByRole('button', { name: 'Emoji 💰' }).click()
    await page.keyboard.press('Escape')

    await page.getByLabel('Name').fill('Bitcoin')
    await page.getByLabel('Symbol').fill('BTC')
    await page.getByLabel('Quantity').fill('2')
    await page.getByLabel('Average buy price').fill('100')
    await page.getByLabel('Current price').fill('150')

    if (size.width >= 1024) {
      const rail = page.getByTestId('summary-rail')
      await expect(rail).toBeVisible()
      await expect(rail).toContainText('Bitcoin')
      // Quantity and average price share a row.
      const q = await page.getByLabel('Quantity').boundingBox()
      const a = await page.getByLabel('Average buy price').boundingBox()
      expect(Math.abs((q?.y ?? 0) - (a?.y ?? 99))).toBeLessThan(8)
    } else {
      await expect(page.getByTestId('summary-rail')).toBeHidden()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(overflow).toBe(false)
    }

    await add.click()
    await expect(page).toHaveURL(/\/investments\/i-1$/)
    await expect(page.getByText('Bitcoin').first()).toBeVisible()
  })
}
