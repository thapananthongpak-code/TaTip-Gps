import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    /*
     * ต้อง build ก่อนเสมอ — `vite preview` เสิร์ฟ dist/ ที่มีอยู่โดยไม่ build ใหม่
     *
     * เคยทำให้เทสต์ผ่านทั้งชุดโดยรันกับโค้ดเก่าที่ build ค้างไว้ ซึ่งอันตรายกว่าเทสต์ตก
     * เพราะรายงานว่า "ผ่าน" ให้กับโค้ดที่ไม่เคยถูกทดสอบเลย
     */
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  workers: 1,
})
