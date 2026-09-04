import { msg } from '@/i18n/messages'

/** ระยะทางสำหรับ "แสดง" บนหน้าจอ */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} ม.`
  return `${(meters / 1000).toFixed(1)} กม.`
}

/** ระยะทางสำหรับ "พูด" — เลี่ยงตัวย่อที่ screen reader/TTS อ่านผิด */
export function speakDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} เมตร`
  const km = meters / 1000
  return `${km.toFixed(1)} กิโลเมตร`
}

/** เวลาที่ผ่านไปตั้งแต่อัปเดตตำแหน่งล่าสุด */
export function formatAge(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 5) return msg.gps.justNow
  if (seconds < 60) return msg.gps.secondsAgo(seconds)
  return msg.gps.minutesAgo(Math.round(seconds / 60))
}

/**
 * ย่อที่อยู่สำหรับ "พูด"
 *
 * display_name ของ Nominatim ยาวมาก (ลงลึกถึงประเทศและรหัสไปรษณีย์)
 * ฟังจนจบแล้วจับใจความไม่ได้ จึงตัดเหลือส่วนต้นที่บอกตำแหน่งได้จริง
 * เช่น "อาคาร, เลขที่, ถนน, แขวง" แล้วปล่อยที่เหลือไว้บนหน้าจอสำหรับคนที่อยากอ่านเต็ม
 */
export function shortenAddressForSpeech(address: string, parts = 4): string {
  return address
    .split(',')
    .slice(0, parts)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
}
