/** The animated backdrops the auth screens can use. Pick one with `VITE_AUTH_BG` (see `.env.example`). */
export const AUTH_BACKGROUNDS = ['blobs', 'grid', 'sweep'] as const
export type AuthBackgroundVariant = (typeof AUTH_BACKGROUNDS)[number]

export const DEFAULT_AUTH_BACKGROUND: AuthBackgroundVariant = 'blobs'

/** Anything that is not a known name falls back to the default, so a typo in `.env` never breaks sign-in. */
export function resolveAuthBackground(value: string | undefined): AuthBackgroundVariant {
  const v = value?.trim().toLowerCase()
  return AUTH_BACKGROUNDS.find((name) => name === v) ?? DEFAULT_AUTH_BACKGROUND
}

/**
 * One uniform page backdrop behind every guest screen (F22, D-F29). Pure decoration: aria-hidden, no
 * content. Grey tones taken from the theme tokens, so it follows light and dark, and only `transform`
 * is animated. Under OS reduced motion it is one still frame (see globals.css).
 *
 * - `blobs`: three large blurred shapes drift slowly (default).
 * - `grid`: a faint dot grid pans diagonally.
 * - `sweep`: a soft diagonal band of light slides across.
 */
export function AuthBackground({
  variant = resolveAuthBackground(import.meta.env.VITE_AUTH_BG),
}: {
  variant?: AuthBackgroundVariant
}) {
  return (
    <div
      aria-hidden
      data-testid="auth-bg"
      data-variant={variant}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {variant === 'blobs' ? (
        <>
          <span className="auth-bg-blob auth-bg-blob-a" />
          <span className="auth-bg-blob auth-bg-blob-b" />
          <span className="auth-bg-blob auth-bg-blob-c" />
        </>
      ) : null}
      {variant === 'grid' ? <span className="auth-bg-grid" /> : null}
      {variant === 'sweep' ? <span className="auth-bg-sweep" /> : null}
    </div>
  )
}
