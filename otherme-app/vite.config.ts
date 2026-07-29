import { existsSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { apiPlugin } from './server/api'

/**
 * Dev only: serve the static pages under `public/<slug>/index.html` (/terms, the
 * contest rules) at their extensionless URLs.
 *
 * Vite's SPA fallback rewrites any extensionless path to the app's index.html
 * before it resolves a directory index, so `/terms` silently renders the Landing
 * page instead of the terms page. Firebase Hosting gets this right in production
 * — it serves static files before applying the `**` rewrite — so without this
 * the two environments disagree and a legal link looks fine in prod but broken
 * locally.
 */
function staticPagesPlugin(): Plugin {
  const publicDir = fileURLToPath(new URL('./public', import.meta.url))
  return {
    name: 'otherme-static-pages',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const pathname = (req.url ?? '').split('?')[0]
        if (pathname && !extname(pathname)) {
          const candidate = `${pathname.replace(/\/+$/, '')}/index.html`
          if (existsSync(join(publicDir, candidate))) req.url = candidate
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiPlugin(), staticPagesPlugin()],
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
