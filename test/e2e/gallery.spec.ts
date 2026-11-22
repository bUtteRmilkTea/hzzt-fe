import { expect, test } from '@playwright/test'

const MOBILE = { width: 360, height: 780 }
const DESKTOP = { width: 1280, height: 800 }

test.describe('gallery (F1 acceptance)', () => {
  test('0.1 + 0.2 through the calculator yields exactly 0.3', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/_gallery')
    const calc = page.getByRole('region', { name: 'Money input' })
    for (const name of ['0', 'Decimal point', '1', 'Plus', '0', 'Decimal point', '2']) {
      await calc.getByRole('button', { name, exact: true }).first().click()
    }
    await expect(page.getByTestId('calc-value')).toHaveText('Value: 0.3')
  })

  test('theme toggle repaints and the choice survives a reload with no flash', async ({ page }) => {
    await page.goto('/_gallery')
    await page.getByRole('radio', { name: 'Light' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    // The boot script must apply the theme before first paint: check before any module runs.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        ;(window as unknown as { __themeAtDcl: string | null }).__themeAtDcl =
          document.documentElement.getAttribute('data-theme')
      })
    })
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const atDcl = await page.evaluate(
      () => (window as unknown as { __themeAtDcl: string | null }).__themeAtDcl,
    )
    expect(atDcl).toBe('light')
  })

  test('hide-amounts removes money strings from the DOM', async ({ page }) => {
    await page.goto('/_gallery')
    await expect(page.getByText('IDR', { exact: false }).first()).toBeVisible()
    await page.getByRole('switch', { name: 'Hide amounts' }).click()
    await expect(page.getByRole('img', { name: 'Amount hidden' }).first()).toBeVisible()
    const body = await page.locator('main').innerHTML()
    expect(body).not.toContain('1,234,567')
    expect(body).not.toContain('42.10')
  })

  test('mobile: bottom sheet closes on Escape and traps focus', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/_gallery')
    await page.getByRole('button', { name: 'Open sheet' }).click()
    const sheet = page.getByRole('dialog', { name: 'Example sheet' })
    await expect(sheet).toBeVisible()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      const inside = await sheet.evaluate((el) => el.contains(document.activeElement))
      expect(inside).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('mobile: sheet drags to dismiss', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/_gallery')
    await page.getByRole('button', { name: 'Open sheet' }).click()
    const sheet = page.getByRole('dialog', { name: 'Example sheet' })
    const box = await sheet.boundingBox()
    if (!box) throw new Error('sheet has no box')
    const x = box.x + box.width / 2
    await page.mouse.move(x, box.y + 8)
    await page.mouse.down()
    await page.mouse.move(x, box.y + box.height, { steps: 12 })
    await page.mouse.up()
    await expect(sheet).toBeHidden()
  })

  test('desktop: sheet becomes a centred dialog', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/_gallery')
    await page.getByRole('button', { name: 'Open sheet' }).click()
    const dialog = page.getByRole('dialog', { name: 'Example sheet' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    if (!box) throw new Error('dialog has no box')
    const centreX = box.x + box.width / 2
    // Centred in the viewport, not docked to the bottom edge.
    expect(Math.abs(centreX - DESKTOP.width / 2)).toBeLessThan(4)
    expect(box.y + box.height).toBeLessThan(DESKTOP.height)
  })

  test('layout has no horizontal overflow at 360px or 1280px', async ({ page }) => {
    for (const vp of [MOBILE, DESKTOP]) {
      await page.setViewportSize(vp)
      await page.goto('/_gallery')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    }
  })
})

test('app shell: tab bar on mobile, sidebar on desktop', async ({ page }) => {
  await page.setViewportSize(MOBILE)
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav.getByRole('link', { name: 'History' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Add transaction' })).toBeVisible()
  await nav.getByRole('link', { name: 'Wallets' }).click()
  await expect(page).toHaveURL(/\/wallets$/)

  await page.setViewportSize(DESKTOP)
  await expect(page.locator('aside')).toBeVisible()
})

test('unknown route shows a not-found state, not a blank page', async ({ page }) => {
  await page.goto('/definitely-not-a-route')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
