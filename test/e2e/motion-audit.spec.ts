// biome-ignore-all lint/plugin: fixture colours only
// Local-only (e2e is not run in CI). F16-T01: does motion actually run in a real browser?
// Samples live CSS animations and the count-up frame a few moments after load, per page.
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
  api.investments.push({
    id: 'i-1',
    name: 'Bitcoin',
    symbol: 'BTC',
    icon: '🪙',
    assetType: 'CRYPTO',
    priceMode: 'MANUAL',
    quoteCurrency: 'USD',
    quantity: '1',
    avgBuyPrice: '100',
    price: '150',
    participants: [],
  })
}

const PAGES = ['', '/history', '/wallets', '/assets', '/investments', '/categories', '/goals']

async function sample(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const anims = document
      .getAnimations()
      .filter((a) => a.playState === 'running')
      .map((a) => (a as CSSAnimation).animationName)
      .filter(Boolean)
    const counting = [...document.querySelectorAll('[data-counting]')].map((e) =>
      e.getAttribute('data-frame'),
    )
    return {
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      running: [...new Set(anims)].join(',') || '-',
      charts: document.querySelectorAll('[data-draw], .chart-slice, .chart-bar, .chart-line-draw')
        .length,
      counting: counting.length,
      frame: counting[0] ?? '-',
    }
  })
}

for (const reduced of ['no-preference', 'reduce'] as const) {
  test(`motion audit, reducedMotion=${reduced}`, async ({ page }) => {
    const api = await installFakeApi(page, { signedIn: true })
    seed(api)
    await page.emulateMedia({ reducedMotion: reduced })
    await page.setViewportSize({ width: 1440, height: 900 })
    const rows: string[] = []
    for (const p of PAGES) {
      await page.goto(`/s/s-1${p}`)
      await page.waitForSelector('main', { state: 'attached' })
      const out: string[] = []
      for (const ms of [50, 250, 500]) {
        await page.waitForTimeout(ms)
        const s = await sample(page)
        out.push(
          `${ms}ms{run:${s.running} charts:${s.charts} counting:${s.counting} frame:${s.frame}}`,
        )
      }
      rows.push(`${(p || '/home').padEnd(12)} ${out.join('  ')}`)
    }
    console.log(`\n== reducedMotion=${reduced}\n${rows.join('\n')}`)
    expect(rows.length).toBe(PAGES.length)
  })
}

// F16-T06: real-browser proof, not jsdom.
test.describe('motion in a real browser (F16)', () => {
  test('the home line is mid-draw shortly after load and fully drawn after', async ({ page }) => {
    const api = await installFakeApi(page, { signedIn: true })
    seed(api)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 1440, height: 1400 }) // tall: every card is in view
    await page.addInitScript(() => {
      const rec: number[] = []
      ;(window as unknown as { __dash: number[] }).__dash = rec
      const t0 = performance.now()
      const tick = () => {
        const el = document.querySelector('.chart-line-draw')
        if (el) rec.push(Number.parseFloat(getComputedStyle(el).strokeDashoffset))
        if (performance.now() - t0 < 8000) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await page.goto('/s/s-1')
    await expect(page.locator('.chart-line-draw').first()).toBeAttached()
    // The recorder started at document start; wait until the line has finished (offset 0).
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __dash: number[] }).__dash.at(-1)), {
        timeout: 6000,
      })
      .toBe(0)
    const offsets = await page.evaluate(() => (window as unknown as { __dash: number[] }).__dash)
    expect(offsets.length).toBeGreaterThan(5)
    expect(Math.max(...offsets)).toBeGreaterThan(0.05) // started undrawn
    expect(offsets.some((o, i) => i > 0 && o < (offsets[i - 1] ?? 0))).toBe(true) // moved
    expect(offsets.at(-1)).toBe(0) // finished
  })

  test('a chart below the fold waits for the scroll, then animates', async ({ page }) => {
    const api = await installFakeApi(page, { signedIn: true })
    seed(api)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 1440, height: 500 })
    await page.goto('/s/s-1')
    const bars = page.getByTestId('bar-chart').locator('xpath=..')
    await expect(bars).toBeAttached()
    await page.waitForTimeout(1500) // longer than any chart animation
    await expect(bars).toHaveAttribute('data-inview', 'false')
    await bars.scrollIntoViewIfNeeded()
    await expect(bars).toHaveAttribute('data-inview', 'true')
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    )
    expect(running).toBeGreaterThan(0)
  })

  test('a count-up shows values between 0 and the final one', async ({ page }) => {
    const api = await installFakeApi(page, { signedIn: true })
    seed(api)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 1440, height: 1400 })
    await page.goto('/s/s-1')
    const seen = new Set<string>()
    for (let i = 0; i < 12; i++) {
      const frames = await page
        .locator('[data-counting]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-frame') ?? ''))
      for (const f of frames) seen.add(f)
      await page.waitForTimeout(80)
    }
    expect(seen.size).toBeGreaterThan(3)
  })

  test('OS reduced motion silences everything; Always play in Settings brings it back', async ({
    page,
  }) => {
    const api = await installFakeApi(page, { signedIn: true })
    seed(api)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 1400 })
    await page.goto('/settings')
    await expect(page.getByTestId('motion-status')).toContainText('animations are off')
    await page.getByRole('radio', { name: 'Always play' }).click()
    await expect(page.getByTestId('motion-status')).toContainText('Always play')
    await page.goto('/s/s-1')
    await expect(page.locator('.chart-line-draw').first()).toBeAttached()
    await expect(page.locator('[data-counting]').first()).toBeAttached({ timeout: 2000 })
    const anims = await page.evaluate(() =>
      document.getAnimations().map((a) => (a as CSSAnimation).animationName),
    )
    expect(anims.some((n) => n.startsWith('chart-'))).toBe(true)
  })

  test('a budget bar grows from empty to its value when seen', async ({ page }) => {
    const api = await installFakeApi(page, { signedIn: true })
    api.categories.push({
      id: 'c-9',
      name: 'Coffee',
      type: 'EXPENSE',
      icon: '☕',
      color: '#ff9f0a',
      sortOrder: 0,
      budgetAmount: '500000',
      spent: 250000,
    })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/s/s-1/categories')
    // Record the width on every frame inside the page, so a slow machine cannot miss the motion.
    const widths = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const out: number[] = []
          const t0 = performance.now()
          const tick = () => {
            const fill = document
              .querySelector('[role="progressbar"][aria-label="Budget used"] > div')
              ?.getBoundingClientRect()
            if (fill) out.push(fill.width)
            if (performance.now() - t0 < 1800) requestAnimationFrame(tick)
            else resolve(out)
          }
          tick()
        }),
    )
    expect(widths.length).toBeGreaterThan(5)
    expect(Math.min(...widths)).toBeLessThan(Math.max(...widths) * 0.6) // it moved
    expect(widths.some((w, i) => i > 0 && w > (widths[i - 1] ?? 0))).toBe(true)
  })
})
