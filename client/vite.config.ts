import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Sends all /api/* requests to the local wrangler dev server.
      // This way the frontend code uses the same relative /api/* URLs
      // in both dev and production — no hardcoded localhost URLs anywhere.
      //
      // To use this:
      //   1. cd worker && npm run dev   (starts on localhost:8787)
      //   2. cd client && npm run dev   (starts on localhost:5173)
      //
      // If you'd rather point at the deployed Worker instead, set
      // VITE_API_BASE=https://netpulse-worker.yourname.workers.dev
      // in client/.env.local and remove this proxy block.
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
