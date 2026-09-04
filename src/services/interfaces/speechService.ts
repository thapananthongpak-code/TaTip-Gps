import type { ServiceLanguage } from '@/types'

export type SpeechPriority = 'low' | 'normal' | 'critical'

export interface SpeakOptions {
  /** critical จะตัดคิวพูดทันที (ใช้กับคำเตือนความปลอดภัย) */
  priority?: SpeechPriority
  language?: ServiceLanguage
  rate?: number
}

/** ครอบ Web Speech API (SpeechSynthesis) — แยกไว้เพื่อ mock ในเทสต์ได้ */
export interface SpeechService {
  isSupported(): boolean
  speak(text: string, options?: SpeakOptions): void
  cancel(): void
  setLanguage(language: ServiceLanguage): void
}
