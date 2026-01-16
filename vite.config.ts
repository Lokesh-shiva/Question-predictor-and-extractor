import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icons/*.png', 'offline.html'],
        manifest: false, // We use our own manifest.json in public/
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          // Only use navigateFallback for truly offline scenarios via cleanupOutdatedCaches
          // navigateFallback should NOT be set when you want the SPA to handle routing normally
          navigateFallbackDenylist: [/^\/api/, /^\/.*/],  // Deny all routes from fallback
          runtimeCaching: [
            {
              // CDN resources (Tailwind, PDF.js, etc.)
              urlPattern: /^https:\/\/cdn\./,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'cdn-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            {
              // cdnjs resources
              urlPattern: /^https:\/\/cdnjs\.cloudflare\.com/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'cdnjs-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              // Google Fonts stylesheets
              urlPattern: /^https:\/\/fonts\.googleapis\.com/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              // Google Fonts webfont files
              urlPattern: /^https:\/\/fonts\.gstatic\.com/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
            {
              // AI Studio CDN
              urlPattern: /^https:\/\/aistudiocdn\.com/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'aistudio-cdn-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
              },
            },
            {
              // Gemini API calls - network first with fallback
              urlPattern: /^https:\/\/.*generativelanguage\.googleapis\.com/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60, // 1 hour
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false, // Disable SW in dev mode to prevent caching issues
        },
      }),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

