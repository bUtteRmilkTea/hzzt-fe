import { EmptyState } from '@/shared/ui/EmptyState'
import { Page } from '@/shared/ui/Page'

/** Stand-in for screens that arrive in later phases. */
export function PlaceholderScreen({ title, phase }: { title: string; phase: string }) {
  return (
    <Page width="form">
      <h1 className="mb-4 text-xl font-semibold">{title}</h1>
      <EmptyState title="Coming soon" description={`This screen is built in phase ${phase}.`} />
    </Page>
  )
}
