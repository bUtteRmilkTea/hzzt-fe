/** Shown while the session is being restored, so the login screen never flashes. */
export function Splash() {
  return (
    <div role="status" aria-label="Loading" className="grid min-h-dvh place-items-center bg-bg">
      <p className="animate-pulse text-xl font-semibold text-label-secondary">HZZT</p>
    </div>
  )
}
