import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/s/$spaceId')({ component: SpaceLayout })

/** Keyed by space id, so switching spaces remounts everything below and nothing can leak across. */
function SpaceLayout() {
  const { spaceId } = Route.useParams()
  return (
    <div key={spaceId}>
      <Outlet />
    </div>
  )
}
