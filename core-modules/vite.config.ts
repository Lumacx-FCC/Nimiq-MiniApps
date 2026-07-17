import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
    // Allow access through Cloudflare quick tunnels (phone testing).
    allowedHosts: ['.trycloudflare.com'],
  },
})
