// Local-only (e2e is not run in CI). F35: every group collapses, template card text stays readable.
import { expect, type Page, test } from '@playwright/test'
import { installFakeApi } from './fakeApi'

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
]

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('a one-row group collapses and expands', async ({ page }) => {
      const api = await installFakeApi(page, { signedIn: true })
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
        price: '100',
        details: { exchangeOrWallet: 'Binance' },
        participants: [],
      })
      await page.goto('/s/s-1/assets')
      const inv = page.getByRole('region', { name: 'Investments' })
      const toggle = inv.getByRole('button', { name: /Binance/ })
      await expect(toggle).toBeVisible()
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await expect(inv.getByText('Bitcoin')).toBeVisible()
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      // The group body collapses to zero height while closed (and inert).
      await expect
        .poll(async () => (await inv.locator('[data-state=closed]').boundingBox())?.height ?? 99, {
          timeout: 3000,
        })
        .toBeLessThan(2)
      await expect(inv.locator('[inert]')).toHaveCount(1)
      await toggle.click()
      await expect(inv.locator('[inert]')).toHaveCount(0)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(overflow).toBe(false)
    })

    test('template wallet card: name and balance are at least 4.5:1 on rendered pixels', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      for (const [id, templateId] of [
        ['w-1', 'waves'],
        ['w-2', 'marble'],
        ['w-3', 'paper'],
      ] as const) {
        api.wallets.push({
          id,
          name: `Tpl ${templateId}`,
          icon: '💳',
          type: 'BANK',
          currency: 'IDR',
          balance: '1000000',
          sortOrder: 0,
          isFavorite: false,
          cardStyle: { mode: 'TEMPLATE', templateId },
        })
      }
      for (const id of ['w-1', 'w-2', 'w-3']) {
        await page.goto(`/s/s-1/wallets/${id}`)
        const card = page.locator('[data-tone]').first()
        await expect(card.getByTestId('card-scrim')).toBeAttached()
        for (const target of [
          card.locator('span.truncate'),
          card.locator('.tabular, [class*=text-xl]').last(),
        ]) {
          const worst = await worstContrast(page, card, target)
          expect(worst, `${id} contrast`).toBeGreaterThanOrEqual(4.5)
        }
      }
    })
  })
}

/** Screenshot the card with text hidden, sample the pixels under the target, return the worst contrast with the text colour. */
async function worstContrast(
  page: Page,
  card: ReturnType<Page['locator']>,
  target: ReturnType<Page['locator']>,
): Promise<number> {
  const textColor = await target.evaluate((el) => getComputedStyle(el).color)
  const box = await target.boundingBox()
  const cardBox = await card.boundingBox()
  if (!box || !cardBox) throw new Error('no boxes')
  await card.evaluate((el) => {
    for (const n of el.querySelectorAll<HTMLElement>('*'))
      n.style.setProperty('color', 'transparent', 'important')
  })
  const shot = await page.screenshot({ clip: box })
  await card.evaluate((el) => {
    for (const n of el.querySelectorAll<HTMLElement>('*')) n.style.removeProperty('color')
  })
  return page.evaluate(
    async ({ b64, textColor }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d') as CanvasRenderingContext2D
      ctx.drawImage(img, 0, 0)
      const lin = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      const lum = (r: number, g: number, b: number) =>
        0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      const [tr, tg, tb] = (textColor.match(/\d+(\.\d+)?/g) ?? []).map(Number)
      const tl = lum(tr as number, tg as number, tb as number)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let worst = 21
      for (let i = 0; i < d.length; i += 4) {
        const l = lum(d[i] as number, d[i + 1] as number, d[i + 2] as number)
        const r = (Math.max(l, tl) + 0.05) / (Math.min(l, tl) + 0.05)
        if (r < worst) worst = r
      }
      return worst
    },
    { b64: shot.toString('base64'), textColor },
  )
}
