// Local-only (e2e is not run in CI). F37: axe in both themes, tap targets, sheet safe-area inset.
import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

async function seed(page: Page) {
  const api = await installFakeApi(page, { signedIn: true })
  api.wallets.push(
    {
      id: 'w-1',
      name: 'Cash',
      icon: '💵',
      type: 'CASH',
      currency: 'IDR',
      balance: '1000000',
      sortOrder: 0,
      isFavorite: false,
      cardStyle: { mode: 'SOLID', color: 'var(--accent)' },
    },
    {
      id: 'w-2',
      name: 'Bank',
      icon: '🏦',
      type: 'BANK',
      currency: 'IDR',
      balance: '2000000',
      sortOrder: 1,
      isFavorite: false,
      cardStyle: { mode: 'TEMPLATE', templateId: 'waves' },
    },
  )
  api.goals.push({
    id: 'g-1',
    name: 'Trip',
    icon: '🎯',
    currency: 'IDR',
    targetAmount: '1000000',
    reserves: { 'w-1': 100000 },
  })
  return api
}

const SCREENS = [
  ['Home', '/s/s-1'],
  ['Assets', '/s/s-1/assets'],
  ['Wallets', '/s/s-1/wallets'],
  ['Goals', '/s/s-1/goals'],
  ['History', '/s/s-1/history'],
  ['Settings', '/settings'],
] as const

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t)
  }, theme)
  await page.waitForTimeout(150)
}

for (const theme of ['dark', 'light'] as const) {
  for (const [name, path] of SCREENS) {
    test(`axe: ${name} (${theme}) has no serious or critical violations`, async ({ page }) => {
      await seed(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1200) // entrance animations settle (contrast is read on final colours)
      await setTheme(page, theme)
      await page.evaluate(AXE)
      const violations = await page.evaluate(async () => {
        // @ts-expect-error injected by the test
        const r = await window.axe.run(document, { resultTypes: ['violations'] })
        return r.violations
          .filter((v: { impact: string }) => v.impact === 'serious' || v.impact === 'critical')
          .map(
            (v: { id: string; nodes: { target: string[] }[] }) =>
              `${v.id}: ${v.nodes
                .slice(0, 4)
                .map((n) => n.target.join(' '))
                .join(' | ')}`,
          )
      })
      expect(violations).toEqual([])
    })
  }
}

test('touch targets: buttons, links and inputs on the main screens are at least 44px tall', async ({
  page,
}) => {
  await seed(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const small: string[] = []
  for (const [name, path] of SCREENS) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    const found = await page.evaluate(() => {
      const out: string[] = []
      for (const el of document.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, [role=tab], [role=radio]',
      )) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (el.closest('[inert], [hidden]')) continue
        const style = getComputedStyle(el)
        if (
          style.visibility === 'hidden' ||
          (style.position === 'absolute' && el.classList.contains('sr-only'))
        )
          continue
        if (
          el instanceof HTMLInputElement &&
          (el.type === 'checkbox' || el.type === 'radio') &&
          r.width < 4
        )
          continue
        // Dense 7-column grid (calendar days): 56 px tall and as wide as 390 px allows (about 43 px).
        if (el.tagName === 'A' && r.height >= 48 && r.width >= 40) continue
        if (Math.min(r.height, r.width) < 47.5)
          out.push(
            `${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
          )
      }
      return out
    })
    for (const f of found) small.push(`${name}: ${f}`)
  }
  expect(small).toEqual([])
})

test('sheet with an emulated 44px safe area keeps its header below the status bar', async ({
  page,
}) => {
  await seed(page)
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(vp)
    await page.goto('/s/s-1/wallets/w-1')
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '44px'))
    await page.getByRole('button', { name: 'Wallet options' }).click()
    const dialog = page.getByRole('dialog', { name: 'Wallet options' })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(600)
    const title = await dialog.getByText('Wallet options', { exact: true }).first().boundingBox()
    expect(title?.y ?? 0).toBeGreaterThanOrEqual(44)
    const box = await dialog.boundingBox()
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(0)
    await page.keyboard.press('Escape')
  }
})
