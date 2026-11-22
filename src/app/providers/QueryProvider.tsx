import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useRef, useState } from 'react'
import { createQueryClient } from '@/shared/api/queryClient'
import { useToast } from '@/shared/ui/Toast'

/** `client` is injectable so tests can inspect the cache. */
export function QueryProvider({
  children,
  client: injected,
}: {
  children: ReactNode
  client?: QueryClient
}) {
  const toast = useToast()
  // The client is created once, but must always call the latest toast function.
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [created] = useState(() =>
    createQueryClient((message) => toastRef.current.show(message, 'error')),
  )
  const client = injected ?? created
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
