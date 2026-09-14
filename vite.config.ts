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
        name: 'Taa-Thip Navigator',
        short_name: 'Taa-Thip',
        description: 'Voice navigation for people with visual impairment, in English and Thai',
        // manifest เป็นไฟล์คงที่ เปลี่ยนตามภาษาที่ผู้ใช้เลือกไม่ได้
        // จึงใช้ภาษาเริ่มต้นของแอปเพื่อให้ตรงกับสิ่งที่ผู้ใช้เจอตอนเปิดครั้งแรก
        lang: 'en',
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
        /*
         * ห้าม service worker ตอบ index.html แทน /api/
         *
         * ตัว navigate fallback มีไว้ให้เปิดแอปตอนออฟไลน์ได้ แต่ถ้าไม่กันไว้
         * คำขอที่เป็นการนำทางไปยัง /api/ จะได้ HTML กลับมาแทน JSON
         * ซึ่งดีบั๊กยากมากเพราะดูเหมือนเซิร์ฟเวอร์ตอบ 200 ปกติ
         */
        navigateFallbackDenylist: [/^\/api\//],
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
          /*
           * ผลค้นหา เส้นทาง และสิ่งกีดขวางต้องเป็นข้อมูลสดเสมอ ห้าม cache เด็ดขาด
           *
           * ถ้าเผลอ cache ไว้ ผู้ใช้อาจได้เส้นทางเก่าที่ไม่ตรงกับตำแหน่งจริงโดยไม่รู้ตัว
           * ซึ่งสำหรับคนที่เดินตามเสียงอย่างเดียว แปลว่าเดินตามคำสั่งที่ผิดไปเรื่อยๆ
           *
           * ครอบให้ครบทุกผู้ให้บริการ ทั้งชุดฟรีเดิมและ Google รวมถึง /api/ ของเราเอง
           * เดิมตกหล่น Photon และ Overpass ไป ทั้งที่สองตัวนั้นก็ตอบข้อมูลที่ใช้เดินทางเหมือนกัน
           */
          {
            urlPattern:
              /^https:\/\/(nominatim\.openstreetmap\.org|routing\.openstreetmap\.de|router\.project-osrm\.org|photon\.komoot\.io|overpass-api\.de|places\.googleapis\.com|routes\.googleapis\.com|maps\.googleapis\.com)\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // proxy ของเราเองที่ถือคีย์ Google — ข้อมูลสดล้วน
            urlPattern: /\/api\/.*/,
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
