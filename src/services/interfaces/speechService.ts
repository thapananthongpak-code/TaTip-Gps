import type { ServiceLanguage } from '@/types'

export type SpeechPriority = 'low' | 'normal' | 'critical'

export interface SpeechSnapshot {
  /** ข้อความล่าสุด — ใส่ค่าเฉพาะตอนที่ต้องให้โปรแกรมอ่านหน้าจออ่านแทน */
  text: string
  /** เพิ่มขึ้นทุกครั้งที่มีข้อความใหม่ ใช้บังคับให้ live region อ่านซ้ำแม้ข้อความเดิม */
  sequence: number
  speaking: boolean
  /**
   * true = แอปพูดเองไม่ได้ กำลังให้โปรแกรมอ่านหน้าจออ่านแทน
   *
   * ต้องแยกสองสถานะนี้ให้ขาด เพราะถ้าแอปพูดอยู่แล้วยังใส่ข้อความลง live region ด้วย
   * ผู้ใช้จะได้ยินสองเสียงอ่านข้อความเดียวกันทับกันจนจับใจความไม่ได้
   */
  usingScreenReader: boolean
}

export interface SpeakOptions {
  /** critical แทนที่คิวปกติได้ แต่ไม่ตัดคำเตือน critical ที่กำลังประกาศอยู่ */
  priority?: SpeechPriority
  group?: string
}

/**
 * ช่องทางที่แอปใช้ "พูด" กับผู้ใช้
 *
 * พยายามพูดด้วยเสียงของแอปเองก่อนเสมอ และถอยไปให้โปรแกรมอ่านหน้าจออ่านแทน
 * เมื่อพูดเองไม่ได้จริงๆ การสลับเกิดขึ้นเอง ไม่มีตัวเลือกให้ผู้ใช้ตั้งค่า
 */
export interface SpeechService {
  subscribe(listener: () => void): () => void
  getSnapshot(): SpeechSnapshot
  speak(text: string, options?: SpeakOptions): void
  cancel(): void
  setLanguage(language: ServiceLanguage): void
  /** ต้องเรียกจาก user gesture หนึ่งครั้ง ไม่งั้น iOS จะไม่ยอมให้แอปออกเสียงเลย */
  unlock(): void
}
