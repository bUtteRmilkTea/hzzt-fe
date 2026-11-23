// Local-only (e2e is not run in CI). F33: chart inspection on touch, fitted axis, calendar day panel.
import { expect, type Page, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

async function seriesOf874(page: Page) {
  await installFakeApi(page, { signedIn: true })
  await page.route(/\/net-worth\/history/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currency: 'IDR',
        range: '1M',
        changePct: '6.5',
        performancePct: '-3.2',
        points: [
          { date: '2026-11-01', netWorth: '820' },
          { date: '2026-11-05', netWorth: '835' },
          { date: '2026-11-10', netWorth: '828' },
          { date: '2026-11-15', netWorth: '860' },
          { date: '2026-11-20', netWorth: '874', live: true },
        ],
      }),
    }),
  )
}

for (const vp of [
  { w: 1440, h: 900, touch: false },
  { w: 390, h: 844, touch: true },
]) {
  test.describe(`${vp.w}px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch })

    test('a series of 874 fills its plot (axis fitted, not -1k to 1.9k)', async ({ page }) => {
      await seriesOf874(page)
      await page.goto('/s/s-1')
      const svg = page.getByTestId('line-chart').first().locator('svg').first()
      await expect(svg).toBeVisible()
      await page.waitForTimeout(1200)
      const { span, plot } = await svg.evaluate((el) => {
        const path = el.querySelector('path[pathLength="1"]') as SVGGraphicsElement
        const b = path.getBBox()
        return { span: b.height, plot: el.getBoundingClientRect().height - 36 }
      })
      expect(span).toBeGreaterThan(plot * 0.7)
    })

    test('inspecting the chart shows date and value, and the page does not overflow', async ({
      page,
    }) => {
      await seriesOf874(page)
      await page.goto('/s/s-1')
      const chart = page.getByTestId('line-chart').first()
      await expect(chart).toBeVisible()
      await page.waitForTimeout(1200)
      const box = (await chart.locator('figure').boundingBox()) as {
        x: number
        y: number
        width: number
        height: number
      }
      if (vp.touch) {
        const cdp = await page.context().newCDPSession(page)
        const y = box.y + box.height / 2
        const startScroll = await page.evaluate(() => window.scrollY)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: box.x + 20, y }],
        })
        for (let i = 1; i <= 8; i++)
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: box.x + 20 + i * (box.width / 10), y: y + i }],
          })
        await expect(chart.getByTestId('chart-tooltip')).toBeVisible()
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        expect(await page.evaluate(() => window.scrollY)).toBe(startScroll) // a horizontal drag does not scroll
        // The tooltip stays inside the chart.
        const tip = (await chart.getByTestId('chart-tooltip').boundingBox()) as {
          x: number
          width: number
        }
        expect(tip.x).toBeGreaterThanOrEqual(box.x - 1)
        expect(tip.x + tip.width).toBeLessThanOrEqual(box.x + box.width + 1)
      } else {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await expect(chart.getByTestId('chart-tooltip')).toBeVisible()
        await expect(chart.getByTestId('chart-tooltip')).toContainText('IDR')
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
    })

    test('keyboard: arrows move the inspected point and announce it', async ({ page }) => {
      await seriesOf874(page)
      await page.goto('/s/s-1')
      const fig = page.getByTestId('line-chart').first().locator('figure')
      await fig.focus()
      await page.keyboard.press('ArrowRight')
      await expect(page.getByTestId('chart-readout').first()).toContainText('1 Nov')
      await page.keyboard.press('ArrowRight')
      await expect(page.getByTestId('chart-readout').first()).toContainText('5 Nov')
    })

    test('Home shows the return excluding deposits and the value change', async ({ page }) => {
      await seriesOf874(page)
      await page.goto('/s/s-1')
      await expect(page.getByTestId('nw-performance')).toHaveText('-3.2%')
      await expect(page.getByTestId('nw-change')).toHaveText('+6.5%')
    })

    test('a calendar day opens a panel with income and expense apart', async ({ page }) => {
      await installFakeApi(page, { signedIn: true })
      await page.goto('/s/s-1')
      const day = page
        .getByRole('list', { name: /Activity in/ })
        .getByRole('button')
        .nth(2)
      await day.scrollIntoViewIfNeeded()
      await day.click()
      const panel = page.getByTestId('day-panel')
      await expect(panel).toBeVisible()
      await expect(panel).toContainText('Income')
      await expect(panel).toContainText('Expense')
      await expect(panel).toContainText('Net')
    })
  })
}
