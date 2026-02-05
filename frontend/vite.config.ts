import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'next/link': path.resolve(__dirname, 'src/lib/nextLinkShim.tsx'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
    },
  },
})
