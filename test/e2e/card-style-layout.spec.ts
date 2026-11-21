// biome-ignore-all lint/plugin: hex strings here are card colours used as test fixtures
// Local-only (e2e is not run in CI). F21: Card style fills the page like Edit wallet.

import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

async function seed(page: import('@playwright/test').Page) {
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
    cardStyle: { mode: 'SOLID', color: '#4480ee' },
  })
}

test('1440px: controls and preview sit side by side, wider than the old 1120px column', async ({
  page,
}) => {
  await seed(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1/wallets/w-1/card')
  const layout = page.getByTestId('card-editor-layout')
  await expect(layout).toBeVisible()
  const l = await layout.boundingBox()
  expect((l?.width ?? 0) > 1120).toBe(true)
  const preview = await page.getByTestId('card-preview').boundingBox()
  const control = await page.getByRole('radiogroup', { name: 'Card style type' }).boundingBox()
  expect((preview?.x ?? 0) > (control?.x ?? 0) + (control?.width ?? 0) - 1).toBe(true)
  // Apply stays reachable.
  await expect(page.getByRole('button', { name: 'Apply' })).toBeInViewport()
})

test('1440px: the preview stays in view while the controls scroll', async ({ page }) => {
  await seed(page)
  await page.setViewportSize({ width: 1440, height: 600 })
  await page.goto('/s/s-1/wallets/w-1/card')
  await page.getByRole('radio', { name: 'Template' }).click()
  await page.mouse.wheel(0, 2000)
  await page.waitForTimeout(200)
  await expect(page.getByTestId('card-preview')).toBeInViewport()
})

test('390px: one column, no overflow, Apply reachable', async ({ page }) => {
  await seed(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/s/s-1/wallets/w-1/card')
  await expect(page.getByTestId('card-editor-layout')).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  const preview = await page.getByTestId('card-preview').boundingBox()
  const control = await page.getByRole('radiogroup', { name: 'Card style type' }).boundingBox()
  expect((control?.y ?? 0) > (preview?.y ?? 0)).toBe(true) // stacked: preview first
  await expect(page.getByRole('button', { name: 'Apply' })).toBeInViewport()
})
