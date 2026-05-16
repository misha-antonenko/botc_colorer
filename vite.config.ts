import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { createManifest } from './src/pwa/manifest'

const appBase = process.env.VITE_APP_BASE ?? '/'

export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      base: appBase,
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.webmanifest',
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable.png',
      ],
      manifest: createManifest(appBase),
      workbox: {
        globPatterns: ['**/*.{css,html,ico,js,png,svg,webmanifest}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
