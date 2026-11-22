// Local-only (e2e is not run in CI). F12: collapsing or expanding one card never moves the other column.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

test('desktop: toggling Investments leaves the Cash card exactly where it was', async ({
  page,
}) => {
  await installFakeApi(page, { signedIn: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/s/s-1/assets')
  const cash = page.getByRole('region', { name: 'Cash' })
  await expect(cash).toBeVisible()
  const before = await cash.boundingBox()

  const toggle = page.getByRole('region', { name: 'Investments' }).getByRole('button', {
    name: 'Investments',
  })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await page.waitForTimeout(400) // the 220ms height transition
  expect(await cash.boundingBox()).toEqual(before)

  await toggle.click()
  await page.waitForTimeout(400)
  expect(await cash.boundingBox()).toEqual(before)
})

test('mobile 360px: columns stack and the page does not scroll sideways', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('/s/s-1/assets')
  await expect(page.getByRole('region', { name: 'Cash' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})
