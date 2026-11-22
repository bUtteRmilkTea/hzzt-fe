// Stand-in for the `virtual:pwa-register` module that vite-plugin-pwa provides in production builds.
export function registerSW(_options?: { onNeedRefresh?: () => void }) {
  return async (_reloadPage?: boolean) => {}
}
