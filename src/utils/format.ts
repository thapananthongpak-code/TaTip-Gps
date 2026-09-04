import i18n from '@/i18n'

/** ระยะทางสำหรับ "แสดง" บนหน้าจอ */
export function formatDistance(meters: number): string {
  if (meters < 1000) return i18n.t('units.meters', { value: Math.round(meters) })
  return i18n.t('units.kilometers', { value: (meters / 1000).toFixed(1) })
}

/** ระยะทางสำหรับ "พูด" — เลี่ยงตัวย่อที่ TTS อ่านผิด เช่น "ม." กับ "กม." */
export function speakDistance(meters: number): string {
  if (meters < 1000) return i18n.t('units.metersSpoken', { value: Math.round(meters) })
  return i18n.t('units.kilometersSpoken', { value: (meters / 1000).toFixed(1) })
}

/** เวลาที่ผ่านไปตั้งแต่อัปเดตตำแหน่งล่าสุด */
export function formatAge(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 5) return i18n.t('gps.justNow')
  if (seconds < 60) return i18n.t('gps.secondsAgo', { count: seconds })
  return i18n.t('gps.minutesAgo', { count: Math.round(seconds / 60) })
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
