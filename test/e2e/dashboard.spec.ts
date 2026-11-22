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
    balance: '1000000',
    sortOrder: 0,
    isFavorite: false,
    cardStyle: { mode: 'SOLID', color: '#34c759' },
  })
  api.categories.push({
    id: 'c-1',
    name: 'Food',
    type: 'EXPENSE',
    icon: '🍜',
    color: '#ff9f0a',
    sortOrder: 0,
    spent: 90000,
  })
}

test('the home dashboard renders every card at phone and desktop width, with no horizontal overflow', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  for (const vp of [
    { width: 360, height: 800 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(vp)
    await page.goto('/s/s-1')
    await expect(page.getByTestId('overview')).toBeVisible()
    await expect(page.getByTestId('line-chart')).toBeVisible()
    await expect(page.getByTestId('donut-chart')).toBeVisible()
    await expect(page.getByTestId('bar-chart')).toBeVisible()
    await expect(page.getByRole('list', { name: /Activity in/ })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  }
})

test('the charts chunk loads only on routes that show a chart', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  const chunks: string[] = []
  page.on('request', (r) => {
    if (/charts/.test(r.url()) && /\.(js|ts|tsx)(\?|$)/.test(r.url())) chunks.push(r.url())
  })
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  expect(chunks).toEqual([]) // none on a screen without a chart

  await page.goto('/s/s-1')
  await expect(page.getByTestId('line-chart')).toBeVisible()
  expect(chunks.length).toBeGreaterThan(0)
})

test('tapping a category slice opens history filtered by it', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  await page.goto('/s/s-1')
  await page.getByTestId('donut-chart').getByRole('button', { name: /Food/ }).click()
  await expect(page).toHaveURL(/\/history\?.*categoryIds/)
})

test('calendar arrows change month and the URL carries it', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  await page.goto('/s/s-1')
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page).toHaveURL(/month=\d{4}-\d{2}/)
})

test('net worth range tabs update the chart and the URL', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  await page.goto('/s/s-1')
  await page.getByRole('radio', { name: '6M' }).click()
  await expect(page).toHaveURL(/range=6M/)
  await expect(page.getByTestId('line-chart')).toBeVisible()
})

test('both themes keep chart colours legible', async ({ page }) => {
  const api = await installFakeApi(page, { signedIn: true })
  seed(api)
  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/s/s-1')
    await expect(page.getByTestId('bar-chart')).toBeVisible()
    const fill = await page
      .locator('rect[data-kind="income"]')
      .first()
      .evaluate((el) => getComputedStyle(el).fill)
    expect(fill).not.toBe('none')
    expect(fill).not.toBe('rgba(0, 0, 0, 0)')
  }
})
