import { Decimal } from '@/shared/money'
import { decimalPlaces, quantityScale } from './schema'

export interface Position {
  quantity: string
  avgBuyPrice: string
}

export interface TradePreview {
  quantity: string
  avgBuyPrice: string
  /** Cash moved: quantity x price plus the fee for a buy, minus it for a sell. In the investment's currency. */
  cash: string
  /** Sell only: (price - average) x quantity - fee. */
  realizedPl: string | null
}

const positive = (v: string) => v !== '' && /^\d+(\.\d+)?$/.test(v) && new Decimal(v).greaterThan(0)
const nonNegative = (v: string) => v === '' || /^\d+(\.\d+)?$/.test(v)

/** A trade is only previewable once the quantity and unit price are valid. */
export function canPreview(quantity: string, unitPrice: string, fee: string): boolean {
  return positive(quantity) && positive(unitPrice) && nonNegative(fee)
}

/**
 * What the position will look like after a BUY, using the backend's formula:
 * new_qty = q + dq, new_avg = (q x avg + dq x price) / new_qty. A preview only: the server decides.
 */
export function previewBuy(
  pos: Position,
  quantity: string,
  unitPrice: string,
  fee: string,
): TradePreview {
  const q = new Decimal(pos.quantity)
  const dq = new Decimal(quantity)
  const price = new Decimal(unitPrice)
  const newQty = q.plus(dq)
  const newAvg = q.times(pos.avgBuyPrice).plus(dq.times(price)).div(newQty)
  return {
    quantity: newQty.toFixed(),
    avgBuyPrice: newAvg.toFixed(),
    cash: dq
      .times(price)
      .plus(fee || '0')
      .toFixed(),
    realizedPl: null,
  }
}

/** After a SELL the average stays and the quantity falls; realized P/L = (price - avg) x dq - fee. */
export function previewSell(
  pos: Position,
  quantity: string,
  unitPrice: string,
  fee: string,
): TradePreview {
  const dq = new Decimal(quantity)
  const price = new Decimal(unitPrice)
  const f = new Decimal(fee || '0')
  return {
    quantity: new Decimal(pos.quantity).minus(dq).toFixed(),
    avgBuyPrice: pos.avgBuyPrice,
    cash: dq.times(price).minus(f).toFixed(),
    realizedPl: price.minus(pos.avgBuyPrice).times(dq).minus(f).toFixed(),
  }
}

/** Whether a sale asks for more than is sellable (held minus staked). */
export function exceedsSellable(
  held: string,
  staked: string | undefined,
  quantity: string,
): boolean {
  if (!positive(quantity)) return false
  return new Decimal(quantity).greaterThan(new Decimal(held).minus(staked || '0'))
}

/**
 * Why a trade quantity is not allowed for this asset type, or null. Crypto allows 8 decimals, US stock 1;
 * an Indonesian stock trades in shares, in multiples of 10 (a lot may have one decimal). Others keep 18.
 */
export function quantityProblem(assetType: string, quantity: string): string | null {
  if (!positive(quantity)) return null
  const scale = quantityScale(assetType)
  if (assetType === 'ID_STOCK') {
    return new Decimal(quantity).div(10).isInteger()
      ? null
      : 'Use whole shares in multiples of 10 (a lot may have one decimal).'
  }
  return decimalPlaces(quantity) > scale
    ? `Use at most ${scale} decimal place${scale === 1 ? '' : 's'}.`
    : null
}
