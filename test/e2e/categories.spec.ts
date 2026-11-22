// biome-ignore-all lint/plugin: hex strings here are fixture category colours
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

function spendOn(api: { categories: Array<{ spent: number }> }, amount: number) {
  const category = api.categories[0]
  if (!category) throw new Error('no category to spend on')
  category.spent = amount
}

test('create a category, set a budget, spend against it, and see the bar move', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  await page.goto('/s/s-1/categories')
  await expect(page.getByText('No expense categories')).toBeVisible()

  await page.getByRole('button', { name: /^Add$/ }).click()
  const sheet = page.getByRole('dialog', { name: /New expense category/ })
  await sheet.getByRole('button', { name: 'Coffee' }).click() // a suggestion prefills the name
  await expect(sheet.getByLabel('Name')).toHaveValue('Coffee')
  for (const k of ['5', '0', '0', '0', '0', '0']) {
    await sheet.getByRole('button', { name: new RegExp(`^${k}$`) }).click()
  }
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Coffee')).toBeVisible()
  await expect(page.getByText(/0\.00% used/)).toBeVisible()

  // Spend 125,000 of the 500,000 budget (the fake API plays the part of recorded transactions).
  spendOn(api, 125000)
  await page.reload()
  await expect(page.getByText(/25\.00% used/)).toBeVisible()
  const bar = page.getByRole('progressbar', { name: 'Budget used' })
  await expect(bar).toHaveAttribute('aria-valuenow', '25')

  spendOn(api, 600000)
  await page.reload()
  await expect(page.getByText(/Over budget/)).toBeVisible()
})

test('a duplicate name shows an inline error on the name field', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  api.categories.push({
    id: 'c-1',
    name: 'Food',
    type: 'EXPENSE',
    icon: '🍜',
    color: '#4480ee',
    sortOrder: 0,
    spent: 0,
  })
  await page.goto('/s/s-1/categories')
  await page.getByRole('button', { name: /^Add$/ }).click()
  const sheet = page.getByRole('dialog', { name: /New expense category/ })
  await sheet.getByLabel('Name').fill('Food')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByText('You already have a category with this name.')).toBeVisible()
  await expect(sheet.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true')
})

test('categories load failure shows a retry state', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.route('**/api/v1/spaces/*/categories**', (r) =>
    r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }),
    }),
  )
  await page.goto('/s/s-1/categories')
  await expect(page.getByText("Couldn't load categories")).toBeVisible()
})
