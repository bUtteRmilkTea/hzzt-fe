// Local-only (e2e is not run in CI). F38: language, filter sheet, settings sections and search.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const cat = (id: string, name: string, type: 'EXPENSE' | 'INCOME', extra: object = {}) => ({
  id,
  name,
  type,
  icon: '🏷️',
  color: 'var(--accent)',
  sortOrder: 0,
  spent: 0,
  ...extra,
})

for (const vp of [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
]) {
  test.describe(`${vp.w}px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } })

    test('Language switch changes a system row and survives a reload', async ({ page }) => {
      const api = await installFakeApi(page, { signedIn: true })
      api.categories.push(
        cat('c-1', 'Salary', 'INCOME', { systemKey: 'SALARY' }),
        cat('c-2', 'Pets', 'INCOME'),
      )
      await page.goto('/settings')
      await page.getByRole('radio', { name: 'Bahasa Indonesia' }).click()
      await page.goto('/s/s-1/categories?tab=INCOME')
      await expect(page.getByText('Gaji', { exact: true })).toBeVisible()
      await expect(page.getByText('Pets', { exact: true })).toBeVisible() // the user's own category is not translated
      await page.reload()
      await expect(page.getByText('Gaji', { exact: true })).toBeVisible()
      await page.goto('/settings')
      await page.getByRole('radio', { name: 'English' }).click()
      await page.goto('/s/s-1/categories?tab=INCOME')
      await expect(page.getByText('Salary', { exact: true })).toBeVisible()
    })

    test('Settings search keeps one scroll, with sections as headings', async ({ page }) => {
      await installFakeApi(page, { signedIn: true })
      await page.goto('/settings')
      await expect(page.getByRole('heading', { level: 2, name: 'Account' })).toBeVisible()
      await page.getByRole('searchbox', { name: 'Search settings' }).fill('lang')
      await expect(page.getByRole('radiogroup', { name: 'Language' })).toBeVisible()
      await expect(page.getByRole('heading', { level: 2, name: 'Account' })).toHaveCount(0)
      await page.getByRole('searchbox', { name: 'Search settings' }).fill('qqq')
      await expect(page.getByText('No settings match "qqq".')).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
    })

    test('Filter with 3 categories: grouped, count badge, removable chips', async ({ page }) => {
      const api = await installFakeApi(page, { signedIn: true })
      api.categories.push(
        cat('c-1', 'Food', 'EXPENSE'),
        cat('c-2', 'Transport', 'EXPENSE'),
        cat('c-3', 'Snacks', 'EXPENSE'),
        cat('c-4', 'Salary', 'INCOME'),
      )
      await page.goto('/s/s-1/history/filters')
      const sheet = page.getByRole('dialog', { name: 'Filters' })
      await expect(sheet.getByTestId('filter-expense')).toBeVisible()
      await expect(sheet.getByTestId('filter-income')).toBeVisible()
      await sheet.getByRole('button', { name: 'Select all expense categories' }).click()
      await sheet.getByRole('button', { name: 'Apply' }).click()
      await expect(page).toHaveURL(/categoryIds/)
      await expect(page.getByRole('link', { name: 'Filters, 3 active' })).toBeVisible()
      const chips = page.getByRole('list', { name: 'Active filters' })
      await expect(chips.getByRole('listitem')).toHaveCount(3)
      await chips.getByRole('button', { name: /Remove filter: .*Food/ }).click()
      await expect(page.getByRole('link', { name: 'Filters, 2 active' })).toBeVisible()
    })
  })
}
