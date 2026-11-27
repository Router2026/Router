import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      workbox: {
        // Pre-cache all build output
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,woff,woff2}'],

        // iOS launch screens are fetched only by iOS at install time — don't precache ~3MB of them
        globIgnores: ['**/icons/splash/**'],

        // SPA: serve index.html for all navigation requests
        navigateFallback: 'index.html',
        // Never intercept API calls
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          {
            // Esri basemap tiles (utils/mapTiles.tsx) — rarely change, cache aggressively
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Street_Map\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'basemap-tiles-v2',
              expiration: { maxEntries: 1000, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase storage images — cache 30 days, max 300 images
            urlPattern: /https:\/\/.*\.supabase\.co\/storage\/v1\/(object|render)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-images-v1',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      manifest: {
        name: 'ראוטר — טיולים בטבע ישראל',
        short_name: 'ראוטר',
        description: 'גלה אתרי טבע, צור מסלולים ושתף חוויות בטבע הישראלי',
        theme_color: '#0d9e6e',
        background_color: '#f7f3e8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'he',
        dir: 'rtl',
        categories: ['travel', 'navigation', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Maskable: emblem kept inside the 80% safe zone so Android's circle/squircle crop never cuts it
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-map':   ['leaflet', 'react-leaflet'],
        },
      },
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // No rewrite — Next.js serves routes under /api/...
      },
    },
  },
});
