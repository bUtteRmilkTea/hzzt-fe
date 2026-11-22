import { z } from 'zod'
import { Decimal } from '@/shared/money'
import { isValidDay } from '@/shared/period'
import type { FieldMeta, TypeMeta } from './types'

const decimalString = /^\d+(\.\d+)?$/
const optionalDecimal = z
  .string()
  .refine((v) => v === '' || decimalString.test(v), 'Enter a number')
const positiveDecimal = (msg: string) =>
  z.string().refine((v) => decimalString.test(v) && new Decimal(v).greaterThan(0), msg)

/** The Zod rule for one `details` field, taken from the field's metadata. A missing key counts as empty. */
export function detailFieldSchema(f: FieldMeta): z.ZodType<string> {
  return z.preprocess(
    (v) => (v === undefined || v === null ? '' : v),
    rawDetailSchema(f),
  ) as unknown as z.ZodType<string>
}

function rawDetailSchema(f: FieldMeta): z.ZodType<string> {
  const label = f.label ?? f.name ?? 'This field'
  const required = (s: string) => (f.required ? s.trim() !== '' : true)
  switch (f.kind) {
    case 'INTEGER':
      return z
        .string()
        .refine(required, `${label} is required`)
        .refine((v) => v === '' || /^[1-9]\d*$/.test(v), `${label} must be a whole number above 0`)
    case 'DECIMAL':
      return z
        .string()
        .refine(required, `${label} is required`)
        .refine((v) => v === '' || decimalString.test(v), `${label} must be a number`)
    case 'DATE':
      return z
        .string()
        .refine(required, `${label} is required`)
        .refine((v) => v === '' || isValidDay(v), `${label} must be a valid date`)
    case 'ENUM':
      return z
        .string()
        .refine(required, `${label} is required`)
        .refine((v) => v === '' || (f.options ?? []).includes(v), `Choose a ${label.toLowerCase()}`)
    default:
      return z.string().max(60, `${label} is too long`).refine(required, `${label} is required`)
  }
}

/** Build the form schema for one asset type from its metadata. */
export function buildTypeSchema(meta: TypeMeta) {
  const assetType = meta.assetType as string
  const lots = meta.quantityMode === 'LOTS'
  const detailShape: Record<string, z.ZodType<string>> = {}
  for (const f of meta.detailFields ?? []) if (f.name) detailShape[f.name] = detailFieldSchema(f)

  return z
    .object({
      assetType: z.literal(assetType),
      name: z.string().trim().min(1, 'Enter a name').max(60, 'Use at most 60 characters'),
      symbol: meta.symbolRequired
        ? z.string().trim().min(1, 'Enter a symbol').max(20, 'Use at most 20 characters')
        : z.string().trim().max(20, 'Use at most 20 characters'),
      icon: z.string().min(1).max(16),
      priceMode: z.enum(['AUTO', 'MANUAL']),
      instrumentId: z.string(),
      // Lots types derive their quantity from `details.lots`, so no quantity is asked for.
      quantity: lots ? z.string() : positiveDecimal('Enter a quantity above 0'),
      avgBuyPrice: optionalDecimal,
      manualPrice: optionalDecimal,
      fees: optionalDecimal,
      manualFxRate: optionalDecimal,
      estimatedAnnualChangePct: optionalDecimal,
      quoteCurrency: z.string(),
      purchaseDate: z.string().refine((v) => v === '' || isValidDay(v), 'Enter a valid date'),
      /** Exchange, broker or platform holding it; empty lets the server derive it from details. */
      wrapper: z.string().trim().max(60, 'Use at most 60 characters').optional(),
      fundingWalletId: z.string(),
      fundingAmount: optionalDecimal,
      details: z.object(detailShape),
    })
    .superRefine((v, ctx) => {
      if (v.priceMode === 'AUTO' && !meta.supportsAutoPrice) {
        ctx.addIssue({
          code: 'custom',
          path: ['priceMode'],
          message: 'Automatic pricing is not available for this type.',
        })
      }
      // Auto mode must be linked to a market instrument, or there is nothing to price.
      if (v.priceMode === 'AUTO' && v.instrumentId === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['instrumentId'],
          message: 'Search and choose an instrument for automatic pricing.',
        })
      }
      const staked = (v.details as Record<string, string>).stakedQuantity
      if (
        staked &&
        v.quantity &&
        decimalString.test(staked) &&
        decimalString.test(v.quantity) &&
        new Decimal(staked).greaterThan(v.quantity)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['details', 'stakedQuantity'],
          message: 'Staked quantity cannot exceed the quantity.',
        })
      }
      if (v.fundingAmount && v.fundingWalletId === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['fundingWalletId'],
          message: 'Choose the wallet that pays for it.',
        })
      }
    })
}

/**
 * A discriminated union on `assetType` over every type the backend lists, so a new backend type
 * needs no frontend change (D-F11).
 */
export function buildInvestmentUnion(metas: readonly TypeMeta[]) {
  const schemas = metas.map(buildTypeSchema)
  const [first, ...rest] = schemas
  if (!first) throw new Error('No investment types')
  return z.discriminatedUnion('assetType', [first, ...rest])
}

export type TypeFormValues = z.infer<ReturnType<typeof buildTypeSchema>>

export const LOT_SIZE_FALLBACK = 100

/** Shares shown read-only for a lots-based type: lots x lot size. Null until lots is a valid whole number. */
export function derivedShares(lots: string, lotSize: number | undefined): string | null {
  if (!/^[1-9]\d*$/.test(lots)) return null
  return new Decimal(lots).times(lotSize ?? LOT_SIZE_FALLBACK).toFixed()
}

/** The JSON body for `POST /investments`, built from validated form values. */
export function toCreateBody(v: TypeFormValues, meta: TypeMeta): Record<string, unknown> {
  const body: Record<string, unknown> = {
    assetType: v.assetType,
    name: v.name.trim(),
    icon: v.icon,
    priceMode: v.priceMode,
  }
  const put = (k: string, val: string) => {
    if (val.trim() !== '') body[k] = val.trim()
  }
  if (v.symbol.trim()) body.symbol = v.symbol.trim().toUpperCase()
  if (meta.quantityMode !== 'LOTS') put('quantity', v.quantity)
  put('avgBuyPrice', v.avgBuyPrice)
  put('fees', v.fees)
  put('manualFxRate', v.manualFxRate)
  put('estimatedAnnualChangePct', v.estimatedAnnualChangePct)
  put('purchaseDate', v.purchaseDate)
  if (v.wrapper?.trim()) body.wrapper = v.wrapper.trim()
  if (v.priceMode === 'MANUAL') put('manualPrice', v.manualPrice)
  if (v.priceMode === 'AUTO' && v.instrumentId) body.instrumentId = v.instrumentId
  if (meta.quoteCurrencyEditable && v.quoteCurrency) body.quoteCurrency = v.quoteCurrency

  const details: Record<string, unknown> = {}
  for (const f of meta.detailFields ?? []) {
    const raw = ((v.details as Record<string, string>)[f.name ?? ''] ?? '').trim()
    if (!f.name || raw === '') continue
    details[f.name] = f.kind === 'INTEGER' ? Number(raw) : raw // a lot count is a count, not money
  }
  if (Object.keys(details).length) body.details = details
  if (v.fundingWalletId)
    body.funding = {
      walletId: v.fundingWalletId,
      ...(v.fundingAmount ? { amount: v.fundingAmount } : {}),
    }
  return body
}
