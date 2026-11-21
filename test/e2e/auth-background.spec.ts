// Local-only (e2e is not run in CI). F22: the animated auth backdrop.

import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const PAGES = ['/login', '/register', '/forgot-password', '/reset-password?token=abc']

/** Sample the first blob's transform on every frame for `ms`. */
const recordBlob = (page: import('@playwright/test').Page, ms: number) =>
  page.evaluate(
    (dur) =>
      new Promise<string[]>((resolve) => {
        const out: string[] = []
        const t0 = performance.now()
        const tick = () => {
          const el = document.querySelector('[data-testid="auth-bg"] span')
          if (el) out.push(getComputedStyle(el).transform)
          if (performance.now() - t0 < dur) requestAnimationFrame(tick)
          else resolve(out)
        }
        tick()
      }),
    ms,
  )

for (const path of PAGES) {
  test(`${path} has the backdrop behind the content`, async ({ page }) => {
    await installFakeApi(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(path)
    const bg = page.getByTestId('auth-bg')
    await expect(bg).toBeAttached()
    await expect(bg).toHaveAttribute('aria-hidden', 'true')
    await expect(bg).toHaveAttribute('data-variant', /blobs|grid|sweep/)
    // It never covers the form: the sign-in controls stay clickable.
    await expect(page.getByRole('main').getByRole('button').first()).toBeVisible()
  })
}

test('with motion on the backdrop really moves', async ({ page }) => {
  await installFakeApi(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  const frames = await recordBlob(page, 2500)
  expect(new Set(frames).size).toBeGreaterThan(10)
})

test('under OS reduced motion the backdrop is one still frame', async ({ page }) => {
  await installFakeApi(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  const frames = await recordBlob(page, 1000)
  expect(new Set(frames).size).toBe(1)
  const running = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => (a as CSSAnimation).animationName)
        .filter((n) => n?.startsWith('auth-bg')).length,
  )
  expect(running).toBe(0)
})

test('390px: no horizontal overflow with the backdrop', async ({ page }) => {
  await installFakeApi(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await expect(page.getByTestId('auth-bg')).toBeAttached()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('axe passes with the backdrop in light and dark', async ({ page }) => {
  const { default: axe } = await import('axe-core')
  for (const scheme of ['dark', 'light'] as const) {
    await installFakeApi(page)
    await page.emulateMedia({ colorScheme: scheme })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/login')
    await expect(page.getByTestId('auth-bg')).toBeAttached()
    await page.addScriptTag({ content: axe.source })
    const bad = await page.evaluate(async () => {
      const r = await (
        window as unknown as {
          axe: {
            run: (
              c: unknown,
              o: unknown,
            ) => Promise<{ violations: Array<{ id: string; help: string; impact: string }> }>
          }
        }
      ).axe.run(document, { rules: { region: { enabled: false } } })
      return r.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.help}`)
    })
    expect(bad, scheme).toEqual([])
  }
})
