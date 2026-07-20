import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { apiPlugin } from './server/api'

export default defineConfig({
  plugins: [react(), apiPlugin()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('../core-modules/src/modules', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    host: true,
    // Allow access through Cloudflare quick tunnels (phone testing in Nimiq Pay).
    allowedHosts: ['.trycloudflare.com'],
    fs: {
      // Let Vite serve core-modules sources from the sibling package.
      allow: ['..'],
    },
  },
})
