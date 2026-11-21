// Local-only (e2e is not run in CI). F20: split auth screens with an animated panel.

import { expect, test } from '@playwright/test'
import axe from 'axe-core'
import { installFakeApi } from './fakeApi'

const SCREENS: Array<[string, string, RegExp | string]> = [
  ['Login', '/login', 'Welcome back'],
  ['Register', '/register', /Create/],
  ['Forgot password', '/forgot-password', /Forgot|Reset/i],
  ['Reset password', '/reset-password?token=abc', /password/i],
]

test.describe('1440px: scene left, form right, one uniform surface (F22)', () => {
  for (const [name, path, heading] of SCREENS) {
    test(name, async ({ page }) => {
      await installFakeApi(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(path)
      const panel = page.getByTestId('auth-panel')
      await expect(panel).toBeVisible()
      const p = await panel.boundingBox()
      const h = await page.getByRole('heading', { name: heading }).first().boundingBox()
      expect((h?.x ?? 0) > (p?.x ?? 0) + (p?.width ?? 0) - 1).toBe(true) // the form is right of the scene
      // Close together: at most 96px between the scene and the form column.
      const gap = (h?.x ?? 0) - ((p?.x ?? 0) + (p?.width ?? 0))
      expect(gap).toBeLessThanOrEqual(96)
      // The group is centred, not pinned to the viewport edges.
      expect((p?.x ?? 0) > 100).toBe(true)
    })
  }
})

test('no divider and one background across the whole screen', async ({ page }) => {
  await installFakeApi(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  const panel = page.getByTestId('auth-panel')
  await expect(panel).toBeVisible()
  const styles = await page.evaluate(() => {
    const panelEl = document.querySelector('[data-testid="auth-panel"]') as HTMLElement
    const main = document.querySelector('main') as HTMLElement
    const cs = getComputedStyle(panelEl)
    return {
      borderRight: cs.borderRightWidth,
      panelBg: cs.backgroundColor,
      mainBg: getComputedStyle(main).backgroundColor,
    }
  })
  expect(styles.borderRight).toBe('0px')
  expect(styles.panelBg).toBe('rgba(0, 0, 0, 0)') // no surface of its own: the page background shows through
  expect(styles.mainBg).not.toBe('rgba(0, 0, 0, 0)')
})

test.describe('390px: the panel is gone and nothing overflows', () => {
  for (const [name, path] of SCREENS) {
    test(name, async ({ page }) => {
      await installFakeApi(page)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(path)
      await expect(page.getByTestId('auth-panel')).toBeHidden()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})

/** The panel line's dash offset, recorded on every frame for `ms`. */
const recordLine = (page: import('@playwright/test').Page, ms: number) =>
  page.evaluate(
    (dur) =>
      new Promise<number[]>((resolve) => {
        const out: number[] = []
        const t0 = performance.now()
        const tick = () => {
          const el = document.querySelector('.auth-line')
          if (el) out.push(Number.parseFloat(getComputedStyle(el).strokeDashoffset))
          if (performance.now() - t0 < dur) requestAnimationFrame(tick)
          else resolve(out)
        }
        tick()
      }),
    ms,
  )

test('with motion on the line really draws and the number counts', async ({ page }) => {
  await installFakeApi(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  const frames = await recordLine(page, 3500)
  expect(frames.length).toBeGreaterThan(20)
  expect(Math.max(...frames)).toBeGreaterThan(0.05) // started undrawn
  expect(frames.some((o, i) => i > 0 && o < (frames[i - 1] ?? 0))).toBe(true) // drawing
  expect(frames.at(-1)).toBe(0) // finished drawing within the window
  // The counting figure showed values between 0 and the final one at some point.
  const seen = new Set<string>()
  await page.reload()
  for (let i = 0; i < 12; i++) {
    for (const f of await page
      .locator('[data-testid="auth-panel"] [data-counting]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-frame') ?? '')))
      seen.add(f)
    await page.waitForTimeout(80)
  }
  expect(seen.size).toBeGreaterThan(3)
})

test('under OS reduced motion the panel is one still, finished frame', async ({ page }) => {
  await installFakeApi(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  const frames = await recordLine(page, 800)
  expect(frames.every((o) => o === 0)).toBe(true) // fully drawn from the first frame
  const running = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => (a as CSSAnimation).animationName)
        .filter((n) => n?.startsWith('auth-')).length,
  )
  expect(running).toBe(0)
  await expect(page.getByTestId('auth-panel')).toContainText('IDR 128,450,000') // the final figure
})

test('the form still works with the panel present', async ({ page }) => {
  await installFakeApi(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await page.getByLabel('Email').fill('not-an-email')
  await page.getByLabel('Password').fill('x')
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await expect(
    page
      .getByRole('alert')
      .or(page.getByText(/valid email|required|invalid/i))
      .first(),
  ).toBeVisible()
})

for (const [name, path] of SCREENS.slice(0, 3)) {
  test(`axe: ${name} has no serious violations`, async ({ page }) => {
    await installFakeApi(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(path)
    await expect(page.getByTestId('auth-panel')).toBeVisible()
    await page.addScriptTag({ content: axe.source })
    // A real browser has layout, so colour contrast is checked here (jsdom cannot).
    const violations = await page.evaluate(async () => {
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
    })
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
}

test('the scene loops: the line is drawn, then starts over', async ({ page }) => {
  test.setTimeout(40_000)
  await installFakeApi(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  const frames = await recordLine(page, 12_500) // one loop is 9s
  const drawn = frames.findIndex((o) => o === 0)
  expect(drawn).toBeGreaterThan(-1)
  // After it was fully drawn, the dash offset goes back up (a new loop begins undrawn).
  expect(frames.slice(drawn).some((o) => o > 0.5)).toBe(true)
})
