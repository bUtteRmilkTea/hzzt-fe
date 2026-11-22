import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSpace } from '@/app/providers/SpaceProvider'
import { looseApi } from '@/shared/api/loose'
import { queryKeys } from '@/shared/api/queryKeys'
import { Decimal } from '@/shared/money'

/** One wrapper row of `GET /spaces/{id}/investments/wrappers` (feedback-be-plan section 2). */
export interface WrapperTarget {
  assetType: string
  /** Lower-cased wrapper key, as used in the PATCH path. */
  key: string
  wrapper?: string
  targetPct: string | null
  actualPct?: string | null
  driftPct?: string | null
}

export interface WrapperTargets {
  items: WrapperTarget[]
}

export interface WrapperPatchResult {
  assetType: string
  wrapper?: string
  targetPct: string | null
  actualPct?: string | null
  category?: { assignedPct: string; unallocatedPct: string }
}

/** Targets per wrapper. Failure is silent: the page still works, just without target percentages. */
export function useWrapperTargets(spaceId: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).investmentWrappers(),
    meta: { silent: true },
    retry: false,
    queryFn: async (): Promise<WrapperTargets> => {
      const { data } = await looseApi.GET<{ items?: WrapperTarget[]; wrappers?: WrapperTarget[] }>(
        '/spaces/{spaceId}/investments/wrappers',
        { params: { path: { spaceId } } },
      )
      return { items: data?.items ?? data?.wrappers ?? [] }
    },
  })
}

/** Sum of the other wrappers' targets in a category: what is already spoken for. */
export function assignedExcluding(
  targets: readonly WrapperTarget[],
  assetType: string,
  key: string,
): Decimal {
  return targets
    .filter((t) => t.assetType === assetType && t.key !== key && t.targetPct != null)
    .reduce((a, t) => a.plus(t.targetPct as string), new Decimal(0))
}

export type PctCheck = { ok: true; value: string | null } | { ok: false; message: string }

/**
 * Validate what the user typed for one wrapper: empty clears, otherwise 0 to 100 with at most 2
 * decimals, and (with the other wrappers) not above 100 in total.
 */
export function checkTargetPct(input: string, assignedByOthers: Decimal): PctCheck {
  const raw = input.trim().replace(/%$/, '').trim()
  if (raw === '') return { ok: true, value: null }
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw))
    return { ok: false, message: 'Enter a percentage with at most 2 decimals.' }
  const d = new Decimal(raw)
  if (d.greaterThan(100)) return { ok: false, message: 'A percentage cannot be above 100.' }
  const available = new Decimal(100).minus(assignedByOthers)
  if (d.greaterThan(available))
    return {
      ok: false,
      message: `Only ${available.toFixed(2)}% is left in this category.`,
    }
  return { ok: true, value: d.toFixed(2) }
}

/** Optimistic single-wrapper update: the number shows at once and snaps back if the server refuses. */
export function useSetWrapperTarget() {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  const key = queryKeys.space(space.id).investmentWrappers()
  return useMutation({
    meta: { silent: true },
    mutationFn: async (v: { assetType: string; key: string; targetPct: string | null }) =>
      (
        await looseApi.PATCH<WrapperPatchResult>(
          '/spaces/{spaceId}/investments/wrappers/{assetType}/{wrapperKey}',
          {
            params: {
              path: {
                spaceId: space.id,
                assetType: v.assetType,
                wrapperKey: v.key,
              },
            },
            body: { targetPct: v.targetPct },
          },
        )
      ).data,
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<WrapperTargets>(key)
      queryClient.setQueryData<WrapperTargets>(key, (cur) => {
        const items = [...(cur?.items ?? [])]
        const idx = items.findIndex((t) => t.assetType === v.assetType && t.key === v.key)
        if (idx >= 0) items[idx] = { ...(items[idx] as WrapperTarget), targetPct: v.targetPct }
        else items.push({ assetType: v.assetType, key: v.key, targetPct: v.targetPct })
        return { items }
      })
      return { previous }
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(key, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
