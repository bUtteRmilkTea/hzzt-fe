// biome-ignore-all lint/plugin: fixture colours only
import { expect, test } from '@playwright/test'
import { type FakeApi, installFakeApi } from './fakeApi'

const seed = (api: FakeApi) => {
  api.wallets.push({
    id: 'w-1',
    name: 'Cash',
    icon: '💵',
    type: 'CASH',
    currency: 'IDR',
    balance: '1000',
    sortOrder: 0,
    isFavorite: false,
    cardStyle: { mode: 'SOLID', color: '#34c759' },
  })
}
const keypad = async (root: import('@playwright/test').Locator, digits: string) => {
  for (const d of digits)
    await root
      .getByRole('button', { name: new RegExp(`^${d}$`) })
      .first()
      .click()
}

test('settling 200 against a 500 debt leaves 300 and lowers the wallet, with no reload', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  api.assets.push({
    id: 'a-1',
    kind: 'LIABILITY',
    name: 'Car loan',
    icon: '💳',
    currency: 'IDR',
    currentValue: '500',
  })
  await page.goto('/s/s-1/assets')
  await expect(page.getByRole('region', { name: 'Debt' }).getByText('Car loan')).toBeVisible()
  await page.getByText('Car loan').click()
  await expect(page.getByTestId('asset-value')).toContainText('500')

  await page.getByRole('button', { name: 'Pay down' }).click()
  const sheet = page.getByRole('dialog', { name: 'Pay down' })
  await keypad(sheet, '600')
  await expect(sheet.getByText("That's more than what is outstanding.")).toBeVisible()
  await sheet.getByRole('button', { name: 'Clear' }).click()
  await keypad(sheet, '200')
  await expect(sheet.getByTestId('outstanding-after')).toContainText('300')
  await sheet.getByRole('button', { name: 'Pay down' }).click()

  await expect(page.getByTestId('asset-value')).toContainText('300')
  await page.getByRole('link', { name: 'Wallets' }).click()
  await expect(page.getByText('800').first()).toBeVisible()
})

test('create a goal, reserve money on a wallet, and see it reduce what is available', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  await page.goto('/s/s-1/goals')
  await expect(page.getByText('No goals yet')).toBeVisible()
  await page.getByRole('link', { name: 'Add goal' }).first().click()
  await page.getByLabel('Name').fill('Holiday')
  await keypad(page.locator('form'), '5000')
  await page.getByLabel('From wallet').selectOption('w-1')
  await expect(page.getByTestId('available')).toContainText('1,000')
  await page.getByRole('button', { name: 'Add goal' }).click()

  await expect(page).toHaveURL(/\/goals\/g-1$/)
  const field = page.getByLabel(/Reserved for this goal/)
  await field.fill('900')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => api.goals[0]?.reserves['w-1']).toBe(900)
  // 1,000 - 900 reserved = 100 available; reserving more than the cap is blocked
  await field.fill('1001')
  await expect(
    page.getByText('That is more than the available balance in this wallet.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()

  await page.goto('/s/s-1/wallets/w-1')
  await expect(page.getByTestId('reserve-lines')).toContainText('900')
  await expect(page.getByTestId('reserve-lines')).toContainText('100')
})

test('a goal that reaches its target is marked achieved', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  api.goals.push({
    id: 'g-1',
    name: 'Phone',
    icon: '📱',
    currency: 'IDR',
    targetAmount: '500',
    reserves: { 'w-1': 500 },
  })
  await page.goto('/s/s-1/goals')
  await page.getByRole('button', { name: /Achieved \(1\)/ }).click()
  await expect(page.getByText('Achieved', { exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
})

test('net worth, sections and totals come from the server', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  api.assets.push({
    id: 'a-2',
    kind: 'FIXED_ASSET',
    name: 'Apartment',
    icon: '🏠',
    currency: 'IDR',
    currentValue: '50000',
  })
  await page.goto('/s/s-1/assets')
  await expect(
    page.getByRole('region', { name: 'Fixed assets' }).getByText('Apartment'),
  ).toBeVisible()
  await expect(page.getByText('51,000').first()).toBeVisible() // 1,000 cash + 50,000 apartment
})
