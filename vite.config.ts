import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:8080'
  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      process.env.ANALYZE
        ? visualizer({ filename: 'stats.html', gzipSize: true, open: false })
        : null,
    ],
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
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
            return undefined
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      env: { VITE_API_BASE_URL: 'http://localhost:8080/api/v1' },
      globals: true,
      setupFiles: ['./test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
      exclude: ['test/e2e/**', 'node_modules/**'],
    },
  }
})
