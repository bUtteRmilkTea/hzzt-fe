// biome-ignore-all lint/plugin: hex strings here are card colours used as test fixtures
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const MOBILE = { width: 360, height: 780 }

test('create wallet with an initial balance -> adjust it -> see the adjustment in history -> delete', async ({
  page,
}) => {
  await installFakeApi(page, { signedIn: true })
  await page.setViewportSize(MOBILE)
  await page.goto('/s/s-1/wallets')
  await expect(page.getByText('No wallets yet')).toBeVisible()

  // create, with an initial balance typed on the mini calculator
  await page.getByRole('button', { name: 'Add wallet' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Add wallet' })
  await sheet.getByLabel('Name').fill('Dana')
  for (const k of ['1', '0', '0', '0', '0', '0', '0']) {
    await sheet.getByRole('button', { name: new RegExp(`^${k}$`) }).click()
  }
  await sheet.getByRole('button', { name: 'Add wallet' }).click()

  // lands on the new wallet, whose history shows the opening balance
  await expect(page).toHaveURL(/\/wallets\/w-1$/)
  await expect(page.getByText('Opening balance').first()).toBeVisible()

  // adjust the balance: the difference is recorded as an adjustment
  await page.getByRole('button', { name: 'Wallet options' }).click()
  await page.getByRole('link', { name: 'Edit wallet' }).click()
  const adjust = page.getByRole('region', { name: 'Adjust balance' })
  for (const k of ['1', '2', '0', '0', '0', '0', '0', '0']) {
    await adjust.getByRole('button', { name: new RegExp(`^${k}$`) }).click()
  }
  await expect(adjust.getByTestId('adjust-preview')).toContainText('+')
  await adjust.getByRole('button', { name: /Set balance/ }).click()

  await page.goBack()
  await expect(page.getByText('Balance adjustment')).toBeVisible()

  // delete: the wallet has money, so there is a second, explicit confirmation
  await page.getByRole('button', { name: 'Wallet options' }).click()
  await page.getByRole('button', { name: /Delete wallet/ }).click()
  await page
    .getByRole('dialog', { name: 'Delete this wallet?' })
    .getByRole('button', { name: 'Delete wallet' })
    .click()
  const force = page.getByRole('dialog', { name: 'This wallet still has money in it' })
  await expect(force).toBeVisible()
  await force.getByRole('button', { name: 'Delete anyway' }).click()
  await expect(page).toHaveURL(/\/wallets$/)
  await expect(page.getByText('No wallets yet')).toBeVisible()
})

test('card style: edits are a draft until Apply, and a cancelled edit changes nothing', async ({
  page,
}) => {
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
    cardStyle: { mode: 'GRADIENT', colors: ['#4480ee', '#ff453a'], direction: 'SE' },
  })
  await page.goto('/s/s-1/wallets/w-1/card')
  const card = page.locator('[data-tone]')
  await expect(card).toHaveCSS('background-image', /135deg|to bottom right/)

  await page.getByRole('button', { name: 'Direction W' }).click()
  await expect(card).toHaveCSS('background-image', /270deg|to left/)
  await page.getByRole('button', { name: 'Cancel' }).click()
  expect(api.wallets[0]?.cardStyle).toMatchObject({ direction: 'SE' }) // nothing saved

  await page.goto('/s/s-1/wallets/w-1/card')
  await page.getByRole('button', { name: 'Direction N', exact: true }).click()
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect.poll(() => api.wallets[0]?.cardStyle).toMatchObject({ direction: 'N' })
})

test('reordering persists across a reload', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  for (const [i, name] of ['A', 'B'].entries()) {
    api.wallets.push({
      id: `w-${i + 1}`,
      name,
      icon: '💳',
      type: 'BANK',
      currency: 'IDR',
      balance: '0',
      sortOrder: i,
      isFavorite: false,
      cardStyle: { mode: 'SOLID', color: '#4480ee' },
    })
  }
  await page.goto('/s/s-1/wallets')
  await page.getByRole('button', { name: 'Reorder' }).click()
  await page.getByRole('button', { name: 'Move B up' }).click()
  await expect.poll(() => api.wallets.find((w) => w.name === 'B')?.sortOrder).toBe(0)
  await page.reload()
  const order = await page
    .getByRole('link', { name: /open wallet/ })
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  expect(order).toEqual(['B, open wallet', 'A, open wallet'])
})

test('a failed reorder snaps back with a toast', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  for (const [i, name] of ['A', 'B'].entries()) {
    api.wallets.push({
      id: `w-${i + 1}`,
      name,
      icon: '💳',
      type: 'BANK',
      currency: 'IDR',
      balance: '0',
      sortOrder: i,
      isFavorite: false,
      cardStyle: { mode: 'SOLID', color: '#4480ee' },
    })
  }
  await page.route('**/api/v1/spaces/*/wallets/order', (r) =>
    r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }),
    }),
  )
  await page.goto('/s/s-1/wallets')
  await page.getByRole('button', { name: 'Reorder' }).click()
  await page.getByRole('button', { name: 'Move B up' }).click()
  await expect(page.getByText(/Something went wrong on our side/)).toBeVisible()
  const order = await page
    .getByRole('link', { name: /open wallet/ })
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  expect(order).toEqual(['A, open wallet', 'B, open wallet'])
})
