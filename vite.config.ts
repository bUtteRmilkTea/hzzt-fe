// biome-ignore-all lint/plugin: the web app manifest needs literal colours, it cannot use CSS variables
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:8080'
  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      // The service worker is only built for production; tests and dev never register one.
      process.env.VITEST
        ? null
        : VitePWA({
            registerType: 'prompt', // the user chooses when to update, so a stale chunk never breaks a tab
            injectRegister: false, // registered by src/shared/pwa/UpdatePrompt.tsx
            includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'fonts/*.woff2'],
            manifest: {
              name: 'HZZT',
              short_name: 'HZZT',
              description: 'Track your wallets, spending, investments and goals.',
              theme_color: '#000000',
              background_color: '#000000',
              display: 'standalone',
              orientation: 'portrait',
              start_url: '/',
              scope: '/',
              icons: [
                { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                {
                  src: '/icons/maskable-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              // Precache the app shell and static assets ONLY.
              globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
              navigateFallback: '/index.html',
              // API responses are never cached or served by the service worker, and are not navigations.
              navigateFallbackDenylist: [/^\/api\//],
              runtimeCaching: [],
              cleanupOutdatedCaches: true,
            },
            devOptions: { enabled: false },
          }),
      process.env.ANALYZE
        ? visualizer({
            filename: process.env.ANALYZE === 'list' ? 'stats.txt' : 'stats.html',
            template: process.env.ANALYZE === 'list' ? 'list' : 'treemap',
            gzipSize: true,
            open: false,
          })
        : null,
    ],
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // The PWA plugin is not loaded under Vitest, so its virtual module is stubbed.
        ...(process.env.VITEST
          ? {
              'virtual:pwa-register': fileURLToPath(
                new URL('./test/stubs/pwa-register.ts', import.meta.url),
              ),
            }
          : {}),
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        // changeOrigin stays false so cookies keep their host
        '/api': { target: apiTarget, changeOrigin: false },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
            if (/node_modules\/@tanstack\//.test(id)) return 'router-query'
            if (/node_modules\/d3-/.test(id)) return 'charts'
            // Optional error reporting: only ever fetched when VITE_SENTRY_DSN is set (D-F12).
            if (/node_modules\/@sentry\//.test(id)) return 'sentry'
            return undefined
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      // Lazily imported routes are transformed on first use, so a long flow can exceed the 5s default.
      testTimeout: 20000,
      env: { VITE_API_BASE_URL: 'http://localhost:8080/api/v1' },
      globals: true,
      setupFiles: ['./test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
      exclude: ['test/e2e/**', 'node_modules/**'],
    },
  }
})
