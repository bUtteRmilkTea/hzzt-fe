import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@/app/providers/SessionProvider'
import { useSpace } from '@/app/providers/SpaceProvider'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'

export const Route = createFileRoute('/_authed/s/$spaceId/')({ component: Home })

function Home() {
  const { user, logout } = useSession()
  const { space } = useSpace()
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Home</h1>
      <Card className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{user?.name}</p>
          <p className="text-sm text-label-secondary">{user?.email}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void logout()}>
          Sign out
        </Button>
      </Card>
      <Card>
        <p className="text-sm text-label-secondary">Active space</p>
        <p data-testid="active-space" className="font-medium">
          {space.avatarEmoji} {space.name} · {space.baseCurrency}
        </p>
      </Card>
      <EmptyState title="Coming soon" description="The dashboard is built in phase F9." />
    </div>
  )
}
