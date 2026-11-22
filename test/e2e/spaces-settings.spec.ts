import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const MOBILE = { width: 360, height: 780 }

test('switching spaces changes what is shown, with nothing from the previous space', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  await page.setViewportSize(MOBILE)
  await page.goto('/')
  await expect(page).toHaveURL(/\/s\/s-1$/)
  await expect(page.getByTestId('active-space')).toContainText('Home · IDR')

  await page.getByRole('button', { name: /Switch space/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Your spaces' })
  await expect(sheet.getByText('Owner · 2 members')).toBeVisible()
  await expect(sheet.getByText('Member · 3 members')).toBeVisible()
  await sheet.getByRole('button', { name: /Family/ }).click()

  await expect(page).toHaveURL(/\/s\/s-2$/)
  await expect(page.getByTestId('active-space')).toContainText('Family · USD')
  await expect(page.getByTestId('active-space')).not.toContainText('Home')
  expect(api.activated).toContain('s-2')
})

test('settings: reach every screen from the index', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.goto('/s/s-1')
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  for (const [link, heading] of [
    ['Profile', 'Profile'],
    ['Space', 'Space'],
    ['Currency', 'Currency'],
    ['App lock', 'Security'],
  ] as const) {
    await page.getByRole('link', { name: new RegExp(`^${link}`) }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Back to settings' }).click()
  }
})

test('a member sees owner-only space settings read-only', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.goto('/s/s-2')
  await page.goto('/settings/space')
  await expect(page.getByLabel('Name')).toHaveAttribute('readonly', '')
  await expect(page.getByText(/Only the space owner can change these settings/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
})

test('hide amounts: toggling shows the eye, revealing is session only', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  await page.goto('/settings')
  await page.getByRole('switch', { name: 'Hide amounts' }).click()
  await expect.poll(() => api.preferences.hideAmounts).toBe(true)
  const eye = page.getByRole('button', { name: 'Show amounts' })
  await eye.click()
  await expect(page.getByRole('button', { name: 'Hide amounts' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(api.preferences.hideAmounts).toBe(true) // revealing never changes the stored preference
})

test('app lock: gate on boot, wrong PIN message, server countdown after repeated failures', async ({
  page,
}) => {
  await installFakeApi(page, { signedIn: true, appLock: true })
  await page.goto('/s/s-1')
  const gate = page.getByRole('dialog', { name: 'App locked' })
  await expect(gate).toBeVisible()
  await expect(page.getByTestId('active-space')).toBeHidden() // content is inert behind the gate

  const enter = async (pin: string) => {
    for (const d of pin) await gate.getByRole('button', { name: d, exact: true }).click()
    await gate.getByRole('button', { name: 'Unlock' }).click()
  }
  for (let i = 0; i < 5; i++) {
    await enter('0000')
    await expect(gate.getByText('That PIN is incorrect.')).toBeVisible()
  }
  await enter('0000')
  await expect(gate.getByRole('alert')).toContainText(/Too many wrong PINs.*4:4\d/)
  await expect(gate.getByRole('button', { name: 'Unlock' })).toBeDisabled()
})

test('app lock: the right PIN unlocks', async ({ page }) => {
  await installFakeApi(page, { signedIn: true, appLock: true })
  await page.goto('/s/s-1')
  const gate = page.getByRole('dialog', { name: 'App locked' })
  for (const d of '1234') await gate.getByRole('button', { name: d, exact: true }).click()
  await gate.getByRole('button', { name: 'Unlock' }).click()
  await expect(gate).toBeHidden()
  await expect(page.getByTestId('active-space')).toBeVisible()
})

test('server error loading spaces shows a retry state', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.route('**/api/v1/spaces', (r) =>
    r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }),
    }),
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Couldn't load your spaces" })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
