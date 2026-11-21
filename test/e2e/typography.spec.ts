// Local-only (e2e is not run in CI). F23: one modern, restrained typeface on every screen.

import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

test('Inter leads the font stack and is really loaded', async ({ page }) => {
  await installFakeApi(page)
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  const info = await page.evaluate(async () => {
    await document.fonts.ready
    return {
      family: getComputedStyle(document.body).fontFamily,
      loaded: document.fonts.check('16px "Inter var"'),
    }
  })
  expect(info.family.startsWith('"Inter var"')).toBe(true)
  expect(info.loaded).toBe(true)
})

test('headings are medium weight with tight tracking; semibold is a firm medium', async ({
  page,
}) => {
  await installFakeApi(page)
  await page.goto('/login')
  const h = page.getByRole('heading', { name: 'Welcome back' })
  await expect(h).toBeVisible()
  const heading = await h.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { weight: cs.fontWeight, tracking: cs.letterSpacing, size: cs.fontSize }
  })
  expect(heading.weight).toBe('500')
  expect(Number.parseFloat(heading.tracking)).toBeLessThan(0)
  const button = await page
    .getByRole('button', { name: 'Sign in' })
    .evaluate((el) => getComputedStyle(el).fontWeight)
  expect(Number(button)).toBeGreaterThanOrEqual(500)
  expect(Number(button)).toBeLessThan(600)
})

test('amounts stay tabular: equal-width digits', async ({ page }) => {
  await installFakeApi(page)
  await page.goto('/login')
  await expect(page.getByTestId('auth-panel')).toBeVisible()
  const widths = await page.evaluate(async () => {
    await document.fonts.ready
    const w = (t: string) => {
      const el = document.createElement('span')
      el.className = 'tabular'
      el.textContent = t
      el.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:32px'
      document.body.appendChild(el)
      const x = el.getBoundingClientRect().width
      el.remove()
      return x
    }
    return [w('1111111'), w('8888888'), w('0000000')]
  })
  expect(new Set(widths).size).toBe(1)
})

test('no horizontal overflow on the main screens at 390px after the font change', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  api.wallets.push({
    id: 'w-1',
    name: 'BCA',
    icon: '🏦',
    type: 'BANK',
    currency: 'IDR',
    balance: '123456789',
    sortOrder: 0,
    isFavorite: false,
    cardStyle: { mode: 'TEMPLATE', templateId: 'classic' },
  })
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/s/s-1', '/s/s-1/wallets', '/s/s-1/wallets/w-1', '/s/s-1/settings']) {
    await page.goto(path)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})
