import { expect, test } from '@playwright/test'

test('app boots and shows the home screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
})
