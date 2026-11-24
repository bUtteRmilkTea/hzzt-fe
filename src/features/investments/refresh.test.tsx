// biome-ignore-all lint/plugin: fixtures only
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import {
  CRYPTO_REFRESH_MS,
  createQueryClient,
  priceRefetchInterval,
} from '@/shared/api/queryClient'
import { BASE } from '../../../test/msw/api'
import { bbca, btc, list } from '../../../test/msw/investments'
import { server } from '../../../test/msw/server'
import { useInvestments } from './hooks'

const I = `${BASE}/spaces/s-1/investments`

function setup(items: unknown[]) {
  let calls = 0
  server.use(
    http.get(I, () => {
      calls++
      return HttpResponse.json(list(items as never))
    }),
  )
  const client = createQueryClient(() => {})
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useInvestments('s-1'), { wrapper })
  return { hook, calls: () => calls }
}

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('crypto price refresh (D-F57)', () => {
  it('is 15 minutes, and only for a space with a market priced holding', () => {
    expect(CRYPTO_REFRESH_MS).toBe(15 * 60_000)
    expect(priceRefetchInterval([{ priceMode: 'AUTO' }, { priceMode: 'MANUAL' }])).toBe(
      CRYPTO_REFRESH_MS,
    )
    expect(priceRefetchInterval([{ priceMode: 'MANUAL' }])).toBe(false)
    expect(priceRefetchInterval([])).toBe(false)
    expect(priceRefetchInterval(undefined)).toBe(false)
  })

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('refetches after 15 minutes and not before', async () => {
      const { hook, calls } = setup([{ ...btc, priceMode: 'AUTO' }])
      await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
      const first = calls()
      await advance(14 * 60_000)
      expect(calls()).toBe(first)
      await advance(60_000 + 500)
      await waitFor(() => expect(calls()).toBe(first + 1))
    })

    it('never polls a space with no market priced holding', async () => {
      const { hook, calls } = setup([{ ...bbca, priceMode: 'MANUAL' }])
      await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
      const first = calls()
      await advance(45 * 60_000)
      expect(calls()).toBe(first)
    })

    it('does not poll while the tab is hidden', async () => {
      const { hook, calls } = setup([{ ...btc, priceMode: 'AUTO' }])
      await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
      const first = calls()
      const original = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      })
      try {
        document.dispatchEvent(new Event('visibilitychange'))
        await advance(45 * 60_000)
        expect(calls()).toBe(first)
      } finally {
        delete (document as unknown as { visibilityState?: string }).visibilityState
        if (original) Object.defineProperty(Document.prototype, 'visibilityState', original)
      }
    })
  })
})
