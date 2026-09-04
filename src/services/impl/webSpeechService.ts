import type { SpeakOptions, SpeechService } from '@/services/interfaces'
import type { ServiceLanguage } from '@/types'

const LANG_TAG: Record<ServiceLanguage, string> = {
  th: 'th-TH',
  en: 'en-US',
}

interface QueueItem {
  text: string
  lang: string
  rate: number
}

/**
 * SpeechService บน Web Speech API (SpeechSynthesis)
 *
 * จุดที่ต้องระวังของ API นี้ และวิธีรับมือในไฟล์นี้:
 * - getVoices() คืนค่าว่างในครั้งแรกบนหลายเบราว์เซอร์ -> ฟัง event `voiceschanged`
 * - iOS/Safari ไม่ยอมพูดถ้ายังไม่เคยมี user gesture -> เปิดทางด้วย unlock()
 * - พูดซ้อนกันจะสับสนมากสำหรับผู้ใช้ที่มองไม่เห็น -> จัดคิวเอง ไม่ยิง speak() รัวๆ
 * - ข้อความ critical (เช่น GPS หาย) ต้องได้ยินทันที -> ตัดคิวที่ค้างอยู่ทิ้ง
 */
class WebSpeechService implements SpeechService {
  private queue: QueueItem[] = []
  private current: SpeechSynthesisUtterance | null = null
  private voices: SpeechSynthesisVoice[] = []
  private language: ServiceLanguage = 'th'
  private unlocked = false

  constructor() {
    if (!this.isSupported()) return
    this.loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', this.loadVoices)
  }

  private loadVoices = () => {
    this.voices = window.speechSynthesis.getVoices()
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  setLanguage(language: ServiceLanguage): void {
    this.language = language
  }

  /**
   * ต้องเรียกจากใน event handler ของ user gesture (คลิก/แตะ) หนึ่งครั้ง
   * มิฉะนั้น iOS จะเงียบไปเลยโดยไม่มี error ให้จับ
   */
  unlock(): void {
    if (!this.isSupported() || this.unlocked) return
    const silent = new SpeechSynthesisUtterance(' ')
    silent.volume = 0
    window.speechSynthesis.speak(silent)
    this.unlocked = true
  }

  speak(text: string, options: SpeakOptions = {}): void {
    if (!this.isSupported() || !text.trim()) return

    const lang = LANG_TAG[options.language ?? this.language]
    const item: QueueItem = { text, lang, rate: options.rate ?? 1 }

    if (options.priority === 'critical') {
      this.queue = [item]
      window.speechSynthesis.cancel()
      this.current = null
      this.drain()
      return
    }

    this.queue.push(item)
    if (!this.current) this.drain()
  }

  cancel(): void {
    if (!this.isSupported()) return
    this.queue = []
    this.current = null
    window.speechSynthesis.cancel()
  }

  private drain(): void {
    const next = this.queue.shift()
    if (!next) {
      this.current = null
      return
    }

    const utterance = new SpeechSynthesisUtterance(next.text)
    utterance.lang = next.lang
    utterance.rate = next.rate
    const voice = this.pickVoice(next.lang)
    if (voice) utterance.voice = voice

    const advance = () => {
      this.current = null
      this.drain()
    }
    utterance.addEventListener('end', advance)
    utterance.addEventListener('error', advance)

    this.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  /** เลือกเสียงที่ตรงภาษาที่สุด — ถ้าไม่มีเสียงไทยติดตั้งอยู่ ปล่อยให้เบราว์เซอร์เลือกเอง */
  private pickVoice(lang: string): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) this.loadVoices()
    const prefix = lang.split('-')[0]
    return (
      this.voices.find((v) => v.lang === lang) ??
      this.voices.find((v) => v.lang.startsWith(prefix)) ??
      this.voices.find((v) => v.lang.replace('_', '-').startsWith(prefix)) ??
      null
    )
  }
}

export const webSpeechService = new WebSpeechService()
