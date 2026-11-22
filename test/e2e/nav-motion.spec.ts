// biome-ignore-all lint/plugin: fixture colours only
// Local-only (e2e is not run in CI). F17: sliding nav highlight, drawer slide, smooth scroll.
import { expect, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const seed = async (page: import('@playwright/test').Page) => {
  const api = await installFakeApi(page, { signedIn: true })
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
}

/** Records the highlight's top edge and opacity on every frame for `ms`, inside the page. */
const recordIndicator = (page: import('@playwright/test').Page, ms: number) =>
  page.evaluate(
    (dur) =>
      new Promise<Array<{ y: number; h: number; o: number }>>((resolve) => {
        const out: Array<{ y: number; h: number; o: number }> = []
        const t0 = performance.now()
        const tick = () => {
          const el = document.querySelector('[data-testid="nav-indicator"]') as HTMLElement | null
          if (el) {
            const r = el.getBoundingClientRect()
            out.push({ y: r.y, h: r.height, o: Number(getComputedStyle(el).opacity) })
          }
          if (performance.now() - t0 < dur) requestAnimationFrame(tick)
          else resolve(out)
        }
        tick()
      }),
    ms,
  )

test.describe('F17 navigation motion (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('the highlight glides Home to Assets through History and Wallets, never vanishing', async ({
    page,
  }) => {
    await page.goto('/s/s-1')
    const nav = page.getByRole('navigation', { name: 'Primary' })
    const y = async (name: string) =>
      (await nav.getByRole('link', { name }).boundingBox())?.y ?? Number.NaN
    const ys = {
      home: await y('Home'),
      history: await y('History'),
      wallets: await y('Wallets'),
      assets: await y('Assets'),
    }
    await expect(page.getByTestId('nav-indicator')).toBeAttached()
    await page.waitForTimeout(400)
    const rec = recordIndicator(page, 1200)
    await nav.getByRole('link', { name: 'Assets' }).click()
    const frames = await rec
    // Started on Home, ended on Assets.
    expect(Math.abs((frames[0]?.y ?? 0) - ys.home)).toBeLessThan(3)
    expect(Math.abs((frames.at(-1)?.y ?? 0) - ys.assets)).toBeLessThan(3)
    // It passed over the in-between tabs: some frame sits near History, and some near Wallets.
    const near = (target: number) =>
      frames.some((f) => Math.abs(f.y - target) < (ys.history - ys.home) * 0.45)
    expect(near(ys.history)).toBe(true)
    expect(near(ys.wallets)).toBe(true)
    // A real glide: many distinct positions, not a jump.
    expect(new Set(frames.map((f) => Math.round(f.y))).size).toBeGreaterThan(8)
    // Never un-highlighted: always visible and always the size of a link.
    expect(frames.every((f) => f.o === 1 && f.h > 30)).toBe(true)
  })

  test('the right drawer slides in from the right edge', async ({ page }) => {
    await page.goto('/s/s-1')
    const rec = page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const out: number[] = []
          const t0 = performance.now()
          const tick = () => {
            const el = document.querySelector('[role="dialog"]')
            if (el) out.push(el.getBoundingClientRect().x)
            if (performance.now() - t0 < 3000) requestAnimationFrame(tick)
            else resolve(out)
          }
          tick()
        }),
    )
    await page.getByRole('button', { name: 'Add transaction' }).click()
    const xs = await rec
    const final = xs.at(-1) ?? 0
    expect(final).toBeLessThan(1440 - 400) // settled at its place, on the right
    expect(Math.max(...xs)).toBeGreaterThan(final + 150) // started further right, off its place
    expect(new Set(xs.map(Math.round)).size).toBeGreaterThan(5) // travelled, not a jump
    expect(xs.every((x, i) => i === 0 || x <= (xs[i - 1] ?? 0) + 1)).toBe(true) // moved leftwards only
  })

  test('smooth scrolling is on, and the OS setting still wins', async ({ page }) => {
    await page.goto('/s/s-1')
    const sb = () => page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)
    expect(await sb()).toBe('smooth')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await sb()).toBe('auto')
  })

  test('with reduced motion the highlight moves at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/s/s-1')
    const nav = page.getByRole('navigation', { name: 'Primary' })
    await page.waitForTimeout(300)
    await nav.getByRole('link', { name: 'Assets' }).click()
    await page.waitForTimeout(150)
    const frames = await recordIndicator(page, 200)
    const target = (await nav.getByRole('link', { name: 'Assets' }).boundingBox())?.y ?? 0
    expect(frames.every((f) => Math.abs(f.y - target) < 3)).toBe(true)
  })
})

test('mobile: the pill glides between tabs', async ({ page }) => {
  await seed(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/s/s-1')
  await page.waitForTimeout(400)
  const xs = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const out: number[] = []
        const t0 = performance.now()
        const tick = () => {
          const el = document.querySelector('[data-testid="nav-indicator"]')
          if (el) out.push(el.getBoundingClientRect().x)
          if (performance.now() - t0 < 1000) requestAnimationFrame(tick)
          else resolve(out)
        }
        tick()
      }),
  )
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Assets' })
    .click()
  const frames = await xs
  expect(new Set(frames.map(Math.round)).size).toBeGreaterThan(6)
})
