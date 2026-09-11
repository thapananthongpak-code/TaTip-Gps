export type SpeechPriority = 'low' | 'normal' | 'critical'

export interface SpeechSnapshot {
  /** ข้อความล่าสุดที่ประกาศออกไป */
  text: string
  /** เพิ่มขึ้นทุกครั้งที่มีข้อความใหม่ ใช้บังคับให้ live region อ่านซ้ำแม้ข้อความเดิม */
  sequence: number
  /** true เมื่อยังมีข้อความค้างอยู่ในคิว */
  speaking: boolean
}

export interface SpeakOptions {
  /** critical แทนที่คิวปกติได้ แต่ไม่ตัดคำเตือน critical ที่กำลังประกาศอยู่ */
  priority?: SpeechPriority
  group?: string
}

/**
 * ช่องทางเดียวที่แอปใช้ "พูด" กับผู้ใช้
 *
 * implementation ปัจจุบันประกาศผ่าน live region ให้โปรแกรมอ่านหน้าจอเป็นผู้อ่าน
 * ไม่สังเคราะห์เสียงเอง เพราะถ้าทั้งแอปและ VoiceOver พูดพร้อมกัน ผู้ใช้จะได้ยินสองเสียงทับกัน
 * และเว็บไม่มี API ที่บอกได้ว่าโปรแกรมอ่านหน้าจอกำลังพูดอยู่หรืออ่านจบแล้ว
 * จึงประสานจังหวะระหว่างสองระบบไม่ได้เลย
 */
export interface SpeechService {
  subscribe(listener: () => void): () => void
  getSnapshot(): SpeechSnapshot
  speak(text: string, options?: SpeakOptions): void
  cancel(): void
}
