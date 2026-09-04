import type { AppSettings } from '@/types'

/**
 * เก็บค่าตั้งค่าของผู้ใช้
 *
 * implementation ปัจจุบันเก็บใน localStorage ของเครื่องเท่านั้น
 * ถ้าวันหนึ่งอยากให้ซิงก์ข้ามอุปกรณ์ ต้องเขียน implementation ใหม่ที่คุยกับเซิร์ฟเวอร์
 * และต้องขอความยินยอมจากผู้ใช้ก่อน เพราะข้อมูลนี้มีเบอร์ผู้ติดต่อฉุกเฉินอยู่ด้วย
 */
export interface SettingsService {
  load(): AppSettings
  save(settings: AppSettings): void
  /** ลบข้อมูลทั้งหมดที่แอปเก็บไว้บนเครื่อง (ปุ่ม "ลบข้อมูลของฉัน") */
  clear(): void
}
