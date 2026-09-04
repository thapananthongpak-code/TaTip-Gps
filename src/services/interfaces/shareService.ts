import type { SharePayload } from '@/types'

export interface ShareContent {
  title: string
  text: string
  url: string
}

export type ShareOutcome = 'shared' | 'copied' | 'unavailable'

/**
 * ส่งตำแหน่งออกไปให้คนอื่น
 *
 * implementation ปัจจุบันใช้ความสามารถของเบราว์เซอร์ล้วนๆ (Web Share / sms: / clipboard)
 * จึงไม่มีข้อมูลใดไหลผ่านเซิร์ฟเวอร์ของแอปเลย
 */
export interface ShareService {
  /** สร้างลิงก์ที่ฝังตำแหน่งไว้ใน fragment (#) ซึ่งเบราว์เซอร์ไม่ส่งไปยังเซิร์ฟเวอร์ */
  buildShareUrl(payload: SharePayload): string
  /** อ่านข้อมูลกลับจากลิงก์ คืน null ถ้าลิงก์เสียหรือหมดอายุแล้ว */
  parseShareUrl(url: string): SharePayload | null
  /** ลิงก์แผนที่มาตรฐานที่เปิดได้ทุกอุปกรณ์ ใช้แนบไปกับข้อความ SMS */
  buildMapUrl(latitude: number, longitude: number): string
  /** เปิดแอปส่งข้อความพร้อมข้อความที่เตรียมไว้ */
  openSms(phone: string, message: string): void
  /** แชร์ผ่าน Web Share API ถ้าไม่รองรับจะคัดลอกลงคลิปบอร์ดแทน */
  share(content: ShareContent): Promise<ShareOutcome>
}
