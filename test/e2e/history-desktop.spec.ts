// Local-only (e2e is not run in CI).
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

test('desktop: filter without a sheet, the URL updates; mobile still opens the sheet', async ({
  page,
}) => {
  await installFakeApi(page, { signedIn: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1/history')
  const panel = page.getByTestId('filter-panel')
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: 'Last 7 days' }).click()
  await expect(page).toHaveURL(/period=LAST_7_DAYS/)
  await expect(page.getByRole('dialog', { name: 'Filters' })).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel).toHaveCount(0)
  await page.getByRole('link', { name: /Filters/ }).click()
  await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible()
})
