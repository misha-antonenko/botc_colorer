import type { ManifestOptions } from 'vite-plugin-pwa'

export const manifest: Partial<ManifestOptions> = {
  name: 'BotC colorer',
  short_name: 'BotC',
  description:
    'Track blue and red team-color inferences for Blood on the Clocktower games.',
  display: 'standalone',
  background_color: '#020617',
  theme_color: '#0f172a',
  start_url: '/',
  scope: '/',
  icons: [
    {
      src: 'icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: 'icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
    },
    {
      src: 'icons/icon-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}
