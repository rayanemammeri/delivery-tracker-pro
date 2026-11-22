import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' : l'application fonctionne à la racine d'un domaine (Netlify, Vercel)
// comme dans un sous-dossier (GitHub Pages). La navigation utilise le hash (#/...).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-v3.png'],
      manifest: {
        name: 'Delivery Tracker Pro',
        short_name: 'Livraisons',
        description: 'Suivi des heures, livraisons et pourboires',
        lang: 'fr-CA',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0f17',
        theme_color: '#0b0f17',
        icons: [
          { src: 'pwa-192-v3.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512-v3.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-v3.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
