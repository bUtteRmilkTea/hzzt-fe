// biome-ignore-all lint/plugin: fixture colour only
// Local-only (e2e is not run in CI).
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const wallet = (id: string, name: string, balance: string, sortOrder: number) => ({
  id,
  name,
  icon: '💵',
  type: 'CASH',
  currency: 'IDR',
  balance,
  sortOrder,
  isFavorite: false,
  cardStyle: { mode: 'SOLID', color: '#34c759' },
})

test('expand animates open, tapping a card opens its detail, reduced motion is instant', async ({
  page,
}) => {
  const api = await installFakeApi(page, { signedIn: true })
  api.wallets.push(wallet('w-1', 'Cash', '1000', 0), wallet('w-2', 'Bank', '3000', 1))
  await page.goto('/s/s-1/wallets')
  const list = page.locator('#wallet-stack')
  await expect(list).toHaveAttribute('data-expanded', 'false')
  const collapsed = (await list.boundingBox())?.height ?? 0
  await page.getByRole('button', { name: 'Expand' }).click()
  await expect(page.getByRole('button', { name: 'Collapse' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expect.poll(async () => (await list.boundingBox())?.height ?? 0).toBeGreaterThan(collapsed)
  await page.getByRole('link', { name: 'Bank, open wallet' }).click()
  await expect(page).toHaveURL(/wallets\/w-2$/)
})

test('reduced motion: the stack opens without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const api = await installFakeApi(page, { signedIn: true })
  api.wallets.push(wallet('w-1', 'Cash', '1000', 0), wallet('w-2', 'Bank', '3000', 1))
  await page.goto('/s/s-1/wallets')
  const list = page.locator('#wallet-stack')
  const before = (await list.boundingBox())?.height ?? 0
  await page.getByRole('button', { name: 'Expand' }).click()
  const after = (await list.boundingBox())?.height ?? 0
  expect(after).toBeGreaterThan(before)
})
