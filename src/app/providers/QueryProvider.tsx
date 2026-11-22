import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useRef, useState } from 'react'
import { createQueryClient } from '@/shared/api/queryClient'
import { useToast } from '@/shared/ui/Toast'

export function QueryProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  // The client is created once, but must always call the latest toast function.
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [client] = useState(() =>
    createQueryClient((message) => toastRef.current.show(message, 'error')),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
