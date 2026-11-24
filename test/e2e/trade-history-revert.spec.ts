// Local-only (e2e is not run in CI). F44: trade history with delete and replay, and the manual
// asset revert. The fake API replays the remaining trades the way the backend does.
import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { type FakeApi, type FakeTrade, installFakeApi } from './fakeApi'

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const wallet = {
  id: 'w-1',
  name: 'Main wallet',
  icon: '💳',
  type: 'BANK',
  currency: 'USD',
  balance: '1000',
  sortOrder: 0,
  isFavorite: false,
  cardStyle: {},
}

const trade = (
  id: string,
  action: 'BUY' | 'SELL',
  quantity: string,
  unitPrice: string,
  day: number,
): FakeTrade => ({
  id,
  action,
  quantity,
  unitPrice,
  walletId: 'w-1',
  occurredAt: `2026-11-${String(day).padStart(2, '0')}T09:00:00Z`,
})

function seed(api: FakeApi, trades: FakeTrade[], quantity: string, avg: string) {
  api.wallets.push({ ...wallet })
  api.investments.push({
    id: 'i-1',
    name: 'Bitcoin',
    symbol: 'BTC',
    icon: '🪙',
    assetType: 'CRYPTO',
    priceMode: 'MANUAL',
    quoteCurrency: 'USD',
    quantity,
    avgBuyPrice: avg,
    price: '300',
    participants: [],
    opening: { quantity: '0', avgBuyPrice: '0' },
    trades,
  })
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
}

for (const vp of [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
]) {
  test.describe(`${vp.w}px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } })

    test('delete the newest buy: the position and the wallet go back', async ({ page }) => {
      const api = await installFakeApi(page, { signedIn: true })
      seed(
        api,
        [trade('t-1', 'BUY', '1', '100', 1), trade('t-2', 'BUY', '1', '200', 2)],
        '2',
        '150',
      )
      await page.goto('/s/s-1/investments/i-1')
      const rows = page.getByTestId('trade-row')
      await expect(rows).toHaveCount(2)
      await expect(rows.first()).toContainText('Buy 1')
      await noOverflow(page)

      await rows
        .first()
        .getByRole('button', { name: /Delete buy/ })
        .click()
      const dialog = page.getByRole('dialog', { name: 'Delete this trade?' })
      await expect(dialog).toContainText('Your position goes from 2 to 1')
      await expect(dialog).toContainText('is returned to Main wallet')
      await dialog.getByRole('button', { name: 'Delete trade' }).click()

      await expect(rows).toHaveCount(1)
      await expect(page.getByText('Trade deleted, position restored')).toBeVisible()
      expect(api.investments[0]?.quantity).toBe('1')
      expect(api.investments[0]?.avgBuyPrice).toBe('100')
      expect(api.wallets[0]?.balance).toBe('1200')
    })

    test('delete an older buy: the later trades are replayed', async ({ page }) => {
      const api = await installFakeApi(page, { signedIn: true })
      seed(
        api,
        [trade('t-1', 'BUY', '1', '100', 1), trade('t-2', 'BUY', '1', '200', 2)],
        '2',
        '150',
      )
      await page.goto('/s/s-1/investments/i-1')
      const rows = page.getByTestId('trade-row')
      await rows
        .last()
        .getByRole('button', { name: /Delete buy of 1 on 1 Nov 2026/ })
        .click()
      const dialog = page.getByRole('dialog', { name: 'Delete this trade?' })
      await expect(dialog).toContainText('recalculated without this trade')
      await dialog.getByRole('button', { name: 'Delete trade' }).click()
      await expect(rows).toHaveCount(1)
      expect(api.investments[0]?.quantity).toBe('1')
      expect(api.investments[0]?.avgBuyPrice).toBe('200')
    })

    test('a buy that a later sale needs cannot be deleted, and the sale can be found', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      seed(
        api,
        [trade('t-1', 'BUY', '1', '100', 1), trade('t-3', 'SELL', '1', '150', 3)],
        '0',
        '100',
      )
      await page.goto('/s/s-1/investments/i-1')
      const rows = page.getByTestId('trade-row')
      await expect(rows.first().getByTestId('trade-realized')).toContainText('$50.00')
      // The fake marks the buy as blocked up front, the same hint the backend sends.
      await expect(page.getByText('A later sale needs this trade.')).toBeVisible()
      await expect(page.getByRole('button', { name: /Delete buy/ })).toHaveCount(0)
      expect(api.investments[0]?.quantity).toBe('0')
    })

    test('keyboard only: open the confirm, Escape cancels, Enter deletes; axe is clean', async ({
      page,
    }) => {
      const api = await installFakeApi(page, { signedIn: true })
      seed(
        api,
        [trade('t-1', 'BUY', '1', '100', 1), trade('t-2', 'BUY', '1', '200', 2)],
        '2',
        '150',
      )
      await page.goto('/s/s-1/investments/i-1')
      const del = page
        .getByTestId('trade-row')
        .first()
        .getByRole('button', { name: /Delete buy/ })
      await del.focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog', { name: 'Delete this trade?' })
      await expect(dialog).toBeVisible()

      await page.evaluate(AXE)
      const violations = await page.evaluate(async () => {
        // @ts-expect-error injected by the test
        const r = await window.axe.run(document, { resultTypes: ['violations'] })
        return r.violations
          .filter((v: { impact: string }) => v.impact === 'serious' || v.impact === 'critical')
          .map((v: { id: string }) => v.id)
      })
      expect(violations).toEqual([])

      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      expect(api.investments[0]?.quantity).toBe('2')

      await del.focus()
      await page.keyboard.press('Enter')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'Delete trade' }).focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('trade-row')).toHaveCount(1)
    })

    test('manual asset: only the newest value change can be reverted', async ({ page }) => {
      const api = await installFakeApi(page, { signedIn: true })
      api.assets.push({
        id: 'a-1',
        kind: 'FIXED_ASSET',
        name: 'Apartment',
        icon: '🏠',
        currency: 'IDR',
        currentValue: '52000000',
        history: [
          {
            id: 'h-2',
            changedAt: '2026-11-01T00:00:00Z',
            previousValue: '50000000',
            newValue: '52000000',
            reason: 'MANUAL',
          },
          {
            id: 'h-1',
            changedAt: '2026-10-01T00:00:00Z',
            previousValue: '48000000',
            newValue: '50000000',
            reason: 'MANUAL',
          },
        ],
      })
      await page.goto('/s/s-1/assets/a-1')
      await expect(page.getByTestId('asset-value')).toContainText('52,000,000')
      await expect(page.getByTestId('revert')).toHaveCount(1)
      await noOverflow(page)
      await page.getByTestId('revert').click()
      const dialog = page.getByRole('dialog', { name: 'Revert this change?' })
      await expect(dialog).toContainText('Set the value back to 50000000')
      await dialog.getByRole('button', { name: 'Revert' }).click()
      await expect(page.getByTestId('asset-value')).toContainText('50,000,000')
      // The next entry is now the newest, so it is the only one that can be reverted.
      await expect(page.getByTestId('revert')).toHaveCount(1)
      await expect(page.getByTestId('revert')).toBeVisible()
    })
  })
}
