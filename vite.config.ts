import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'GeoRepo — Geological Field-to-Report',
        short_name: 'GeoRepo',
        description: 'Voice-first offline geological field capture and report automation system',
        theme_color: '#0f141c',
        background_color: '#0f141c',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230284c7"/><text y=".9em" font-size="70" x="15" fill="white">G</text></svg>',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230284c7"/><text y=".9em" font-size="70" x="15" fill="white">G</text></svg>',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  server: {
    port: 3000,
    open: false
  },
  build: {
    target: 'esnext'
  }
});
