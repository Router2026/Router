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

        // SPA: serve index.html for all navigation requests
        navigateFallback: 'index.html',
        // Never intercept API calls
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          {
            // CARTO map tiles — rarely change, cache aggressively
            urlPattern: /https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'carto-tiles-v1',
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
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'he',
        dir: 'rtl',
        categories: ['travel', 'navigation', 'lifestyle'],
        icons: [
          {
            src: '/pwa-icon.jpg',
            sizes: '192x192',
            type: 'image/jpeg',
          },
          {
            src: '/pwa-icon.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
          },
          {
            // Maskable: fill the entire icon area (safe zone ≈ inner 80%)
            src: '/pwa-icon.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],

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
