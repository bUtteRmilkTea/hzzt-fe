// Local-only (e2e is not run in CI). F12: no permanent filter column; filters open as a panel.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

test('desktop: toolbar filters open a side panel with Apply, chips show, URL survives a new tab', async ({
  page,
  context,
}) => {
  await installFakeApi(page, { signedIn: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/s/s-1/history')
  await expect(page.getByTestId('filter-panel')).toHaveCount(0)

  await page.getByRole('link', { name: /Filters/ }).click()
  const panel = page.getByRole('dialog', { name: 'Filters' })
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: 'Last 7 days' }).click()
  await panel.getByRole('button', { name: 'Apply' }).click()
  await expect(page).toHaveURL(/period=LAST_7_DAYS/)
  await expect(page.getByRole('list', { name: 'Active filters' })).toBeVisible()

  // The filters never scroll separately from the page: nothing on the page is an inner scroller.
  const innerScrollers = await page.evaluate(
    () =>
      [...document.querySelectorAll('aside')].filter(
        (a) => getComputedStyle(a).overflowY === 'auto' && a.scrollHeight > a.clientHeight,
      ).length,
  )
  expect(innerScrollers).toBe(0)

  // Copy-paste the URL into a new tab: the same filtered view.
  const second = await context.newPage()
  await installFakeApi(second, { signedIn: true })
  await second.goto(page.url())
  await expect(second.getByRole('list', { name: 'Active filters' })).toBeVisible()
})

test('mobile: Filters still opens a bottom sheet', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/s/s-1/history')
  await page.getByRole('link', { name: /Filters/ }).click()
  await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible()
})
