import type { ServiceLanguage } from '@/types'

export type SpeechPriority = 'low' | 'normal' | 'critical'
export type SpeechMode = 'reader' | 'app'
export interface SpeechSnapshot {
  mode: SpeechMode
  text: string
  sequence: number
  failed: boolean
  speaking: boolean
}

export interface SpeakOptions {
  /** Critical replaces ordinary queued speech, but does not cut another critical warning. */
  priority?: SpeechPriority
  language?: ServiceLanguage
  rate?: number
  group?: string
}

/** ครอบ Web Speech API (SpeechSynthesis) — แยกไว้เพื่อ mock ในเทสต์ได้ */
export interface SpeechService {
  subscribe(listener: () => void): () => void
  getSnapshot(): SpeechSnapshot
  setMode(mode: SpeechMode): void
  isSupported(): boolean
  /**
   * เปิดสิทธิ์ให้พูดได้ ต้องเรียกจาก user gesture หนึ่งครั้งตอนเริ่มใช้แอป
   * (iOS/Safari บล็อกเสียงที่ไม่ได้เกิดจากการแตะของผู้ใช้)
   */
  unlock(): void
  speak(text: string, options?: SpeakOptions): void
  /**
   * มีเสียงพูดของภาษานี้ติดตั้งอยู่ในอุปกรณ์หรือไม่
   * เครื่องที่ไม่มีเสียงภาษาไทยจะอ่านภาษาไทยด้วยเสียงภาษาอื่น ซึ่งฟังแทบไม่รู้เรื่อง
   * ต้องบอกผู้ใช้ให้รู้ตัว ไม่ใช่ปล่อยให้งงว่าทำไมฟังไม่ออก
   */
  hasVoiceFor(language: ServiceLanguage): boolean
  cancel(): void
  setLanguage(language: ServiceLanguage): void
}
