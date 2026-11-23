// Local-only (e2e is not run in CI). A quantity is a count, not money: it is never rounded to a currency's decimals.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

test('crypto quantity keeps 8 decimals (0.00566444)', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.goto('/s/s-1/investments/new')
  await page.getByLabel('Type').selectOption('CRYPTO')
  const qty = page.getByLabel('Quantity', { exact: true })
  await qty.fill('0.00566444')
  await qty.blur()
  await expect(qty).toHaveValue('0.00566444')
})
