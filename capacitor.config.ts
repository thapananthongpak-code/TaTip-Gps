import type { CapacitorConfig } from '@capacitor/cli'

/**
 * ห่อเว็บแอปเดิมเป็นแอป Android โดยไม่เขียนโค้ดใหม่
 *
 * เลือก Capacitor แทน React Native เพราะหัวใจของแอปนี้คือการเข้าถึงแบบเว็บ:
 * live region ที่ TalkBack อ่านได้ แผนที่ที่วาดด้วย DOM และเสียงของเบราว์เซอร์
 * ทั้งหมดทำงานต่อได้ทันทีใน WebView แต่ต้องเขียนใหม่ทั้งหมดถ้าย้ายไป React Native
 */
const config: CapacitorConfig = {
  appId: 'com.taathip.navigator',
  appName: 'Taa-Thip Navigator',
  webDir: 'dist',
  android: {
    /*
     * ห้ามโหลดเนื้อหา http ปนใน https
     * แอปส่งพิกัดของผู้ใช้ออกไปหาบริการแผนที่ ถ้ายอมให้ปนก็เท่ากับเปิดช่องดักอ่านกลางทาง
     */
    allowMixedContent: false,
  },
  server: {
    /*
     * https:// ไม่ใช่ file:// เพื่อให้ isSecureContext เป็นจริง
     * ซึ่งเป็นเงื่อนไขบังคับของ Geolocation และ Service Worker
     */
    androidScheme: 'https',
  },
}

export default config
