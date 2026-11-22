import { createFileRoute, notFound } from '@tanstack/react-router'
import { Gallery } from '@/dev/Gallery'

// Dev-only component gallery: renders every primitive for visual checks.
export const Route = createFileRoute('/_gallery')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: Gallery,
})
