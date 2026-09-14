declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean }
  }
}

/**
 * true เมื่อกำลังรันเป็นแอปที่ติดตั้งจากไฟล์ APK ไม่ใช่เปิดผ่านเว็บ
 *
 * Capacitor ฉีดตัวแปรนี้เข้ามาก่อนโค้ดของแอปเริ่มทำงาน
 * จึงเชื่อถือได้ตั้งแต่จังหวะแรกสุด ไม่ต้องรอ event ใด
 */
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true
}

/**
 * ถอน service worker และล้าง cache ทิ้งเมื่อรันเป็นแอปติดตั้ง
 *
 * ทำไมต้องถอน ไม่ใช่แค่ไม่ลงทะเบียนเพิ่ม:
 * ไฟล์ทั้งหมดอยู่ในเครื่องอยู่แล้วตั้งแต่ติดตั้ง APK การแคชซ้ำจึงไม่ได้ประโยชน์อะไรเลย
 * แต่มีโทษจริง — ทดสอบบนอีมูเลเตอร์แล้วพบว่า หลังติดตั้ง APK เวอร์ชันใหม่ทับของเดิม
 * service worker ยังเสิร์ฟไฟล์เวอร์ชันเก่าที่แคชไว้ แล้วขึ้นแถบ "มีเวอร์ชันใหม่"
 * ให้ผู้ใช้กดอัปเดตอีกชั้นหนึ่ง ทั้งที่เพิ่งติดตั้งเวอร์ชันใหม่ไปแล้ว
 *
 * สำหรับผู้ใช้ที่มองไม่เห็น การมีขั้นตอนที่ไม่จำเป็นและอธิบายไม่ได้แบบนี้
 * คือความสับสนที่หาทางออกเองได้ยาก
 */
export async function dropServiceWorkerOnNative(): Promise<void> {
  if (!isNativeApp()) return

  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(registrations.map((registration) => registration.unregister()))
  } catch {
    // เบราว์เซอร์บางรุ่นไม่ให้เข้าถึง ไม่ใช่เรื่องคอขาดบาดตาย
  }

  try {
    const keys = (await caches?.keys()) ?? []
    await Promise.all(keys.map((key) => caches.delete(key)))
  } catch {
    // เช่นเดียวกัน ถ้าล้างไม่ได้ก็ยังใช้งานได้ตามปกติ
  }
}
