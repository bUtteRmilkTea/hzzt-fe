import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

test('app boots and shows the home screen when signed in', async ({ page }) => {
  await installFakeApi(page, { signedIn: true })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
})
