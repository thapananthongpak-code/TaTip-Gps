import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'icons/icon-64.png'],
      manifest: {
        name: 'ตาทิพย์ Navigator',
        short_name: 'ตาทิพย์',
        description: 'แอปนำทางด้วยเสียงสำหรับผู้พิการทางสายตา รองรับภาษาไทยและอังกฤษ',
        lang: 'th',
        dir: 'ltr',
        theme_color: '#0f52ab',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['navigation', 'travel', 'utilities'],
        icons: [
          { src: 'icons/icon-64.png', sizes: '64x64', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // แผนที่ที่เคยโหลดแล้วยังดูได้ตอนออฟไลน์
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            // Fetch uses the browser HTTP cache (Cache-Control/ETag); stored
            // responses are a fallback for revisits only. No prefetch/download.
            handler: 'NetworkFirst',
            options: {
              cacheName: 'osm-tiles-v2',
              networkTimeoutSeconds: 3,
              expiration: {
                // จำกัดไว้ไม่ให้กินพื้นที่เครื่องผู้ใช้เกินควร และเคารพนโยบายของ OSM
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
          // ผลค้นหาและเส้นทางต้องเป็นข้อมูลสด ห้าม cache
          // ถ้าเผลอ cache ไว้ ผู้ใช้อาจได้เส้นทางเก่าที่ไม่ตรงกับตำแหน่งจริงโดยไม่รู้ตัว
          {
            urlPattern:
              /^https:\/\/(nominatim\.openstreetmap\.org|routing\.openstreetmap\.de|router\.project-osrm\.org)\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        // ปิดใน dev เพื่อไม่ให้ service worker แคชระหว่างพัฒนา
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    host: true, // เข้าถึงจากมือถือในวง LAN เดียวกันได้ (ต้องใช้ HTTPS หรือ localhost ถึงจะขอ GPS ได้)
  },
})
