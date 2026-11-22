import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const MOBILE = { width: 360, height: 780 }
const DESKTOP = { width: 1280, height: 800 }

test('register -> reload keeps the session -> logout', async ({ page }) => {
  const api = await installFakeApi(page)
  await page.goto('/register')
  await page.getByLabel('Name').fill('Jane')
  await page.getByLabel('Email').fill('jane@example.com')
  await page.getByLabel('Password').fill('correct horse')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()

  // The access token lives only in memory: nothing in either storage.
  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage, cookie: document.cookie }),
  )
  expect(stored).not.toContain('e2e-access-token')

  // Hard reload: the refresh cookie restores the session with no flash of the login screen.
  let sawLogin = false
  await page.exposeFunction('markLogin', () => {
    sawLogin = true
  })
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.body?.textContent?.includes('Welcome back')) {
        ;(window as unknown as { markLogin: () => void }).markLogin()
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
  expect(sawLogin).toBe(false)
  expect(api.calls.refresh).toBe(1) // exactly one refresh for the reload

  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'History' })
    .click()
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
})

test('wrong password shows a friendly sentence, not a code', async ({ page }) => {
  await installFakeApi(page)
  await page.goto('/login')
  await page.getByLabel('Email').fill('jane@example.com')
  await page.getByLabel('Password').fill('nope nope nope')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('email and password combination is incorrect')
  await expect(page.locator('body')).not.toContainText('INVALID_CREDENTIALS')
})

test('client-side validation blocks an empty submit', async ({ page }) => {
  await installFakeApi(page)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Enter a valid email address')).toBeVisible()
})

test('server error on sign-in is shown, and the form stays usable', async ({ page }) => {
  await page.route('**/api/v1/auth/refresh', (r) =>
    r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  )
  await page.route('**/api/v1/auth/login', (r) =>
    r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR' }, requestId: 'req-500' }),
    }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('jane@example.com')
  await page.getByLabel('Password').fill('correct horse')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('Something went wrong on our side')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
})

test('a signed-out visit to a protected page redirects to login and returns after sign-in', async ({
  page,
}) => {
  await installFakeApi(page)
  await page.goto('/history')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fhistory/)
  await page.getByLabel('Email').fill('jane@example.com')
  await page.getByLabel('Password').fill('correct horse')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
  await expect(page).toHaveURL(/\/history$/)
})

test('sign out returns to the login screen and stays signed out after reload', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

test.describe('app shell', () => {
  test('tab bar on mobile', async ({ page }) => {
    await installFakeApi(page, { signedIn: true })
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByRole('link', { name: 'History' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Add transaction' })).toBeVisible()
    await nav.getByRole('link', { name: 'Wallets' }).click()
    await expect(page).toHaveURL(/\/wallets$/)
  })

  test('sidebar on desktop', async ({ page }) => {
    await installFakeApi(page, { signedIn: true })
    await page.setViewportSize(DESKTOP)
    await page.goto('/')
    await expect(page.locator('aside')).toBeVisible()
  })

  test('unknown route shows a not-found state', async ({ page }) => {
    await installFakeApi(page, { signedIn: true })
    await page.goto('/definitely-not-a-route')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  })
})
