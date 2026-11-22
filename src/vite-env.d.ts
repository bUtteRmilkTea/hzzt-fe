/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_ENABLE_MSW?: string
  /** Sentry DSN. Error reporting is off unless this is set (D-F12). */
  readonly VITE_SENTRY_DSN?: string
  /** Auth screen backdrop: `blobs` (default), `grid` or `sweep` (F22, D-F29). */
  readonly VITE_AUTH_BG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string
