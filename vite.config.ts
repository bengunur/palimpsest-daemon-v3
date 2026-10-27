import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: GitHub Pages serves the project at /palimpsest-daemon/.
// The /api proxy exists only in the local dev server; the public build never calls it.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/palimpsest-daemon/' : '/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
})
