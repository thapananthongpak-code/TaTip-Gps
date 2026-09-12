import type {
  SpeakOptions,
  SpeechService,
  SpeechSnapshot,
} from '@/services/interfaces/speechService'
import type { ServiceLanguage } from '@/types'

interface QueueItem {
  text: string
  options: SpeakOptions
  expires: number
}

const LANG_TAG: Record<ServiceLanguage, string> = { th: 'th-TH', en: 'en-US' }

/** ข้อความที่ค้างนานกว่านี้ไม่ทันการณ์แล้ว ทิ้งดีกว่าประกาศย้อนหลัง */
const STALE_AFTER_MS = 20_000
const MAX_QUEUE = 8

/** ไม่เริ่มพูดภายในเวลานี้ ถือว่าเสียงของแอปใช้ไม่ได้ แล้วถอยไปใช้โปรแกรมอ่านหน้าจอ */
const START_DEADLINE_MS = 3000

/** จังหวะที่เว้นให้โปรแกรมอ่านหน้าจออ่านจบ (ARIA ไม่มี event บอก) */
const readerPace = (text: string) => Math.min(12_000, Math.max(2500, text.length * 65))

/**
 * แอปพูดด้วยเสียงของตัวเอง และถอยไปให้โปรแกรมอ่านหน้าจออ่านแทนเมื่อพูดเองไม่ได้
 *
 * ทำไมต้องเป็นสองทางแบบสลับอัตโนมัติ ไม่ใช่เลือกทางใดทางหนึ่ง:
 * - ถ้าใช้โปรแกรมอ่านหน้าจออย่างเดียว คนที่ไม่ได้เปิดไว้จะไม่ได้ยินอะไรเลย
 * - ถ้าแอปพูดเองพร้อมกับใส่ข้อความลง live region จะได้ยินสองเสียงทับกัน
 *   เพราะ VoiceOver อ่าน live region ไปพร้อมกับที่แอปกำลังพูดประโยคเดียวกัน
 *
 * จึงใส่ข้อความลง live region **เฉพาะตอนที่แอปพูดเองไม่ได้** เท่านั้น
 * ระหว่างที่แอปพูดได้ live region จะว่าง โปรแกรมอ่านหน้าจอจึงไม่มีอะไรให้อ่านซ้ำ
 *
 * ⚠️ ไม่ว่าทางไหน ระบบไม่มีทางรู้ว่าผู้ใช้ได้ยินจริงหรือไม่ (เครื่องอาจปิดเสียงอยู่)
 * ห้ามถือว่าประกาศแล้วเท่ากับผู้ใช้รับรู้แล้ว
 */
export class AppSpeechService implements SpeechService {
  private queue: QueueItem[] = []
  private current: QueueItem | null = null
  private utterance: SpeechSynthesisUtterance | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private language: ServiceLanguage = 'th'
  private unlocked = false
  private listeners = new Set<() => void>()
  private snapshot: SpeechSnapshot = {
    text: '',
    sequence: 0,
    speaking: false,
    usingScreenReader: false,
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  private publish(update: Partial<SpeechSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update }
    this.listeners.forEach((listener) => listener())
  }

  setLanguage(language: ServiceLanguage) {
    this.language = language
  }

  private get synthesis(): SpeechSynthesis | null {
    if (typeof window === 'undefined') return null
    const synthesis = window.speechSynthesis
    return typeof synthesis?.speak === 'function' ? synthesis : null
  }

  /**
   * iOS ไม่ยอมให้เล่นเสียงที่ไม่ได้เกิดจากการแตะของผู้ใช้
   * ต้องเรียกจากใน event handler ของปุ่มจริง ไม่ใช่จาก effect
   */
  unlock() {
    const synthesis = this.synthesis
    if (!synthesis || this.unlocked) return
    this.unlocked = true
    try {
      synthesis.resume()
      // ปลุกเครื่องยนต์เสียงด้วยข้อความว่างที่ไม่มีใครได้ยิน
      const primer = new SpeechSynthesisUtterance(' ')
      primer.volume = 0
      synthesis.speak(primer)
    } catch {
      // ปลดล็อกไม่สำเร็จก็ยังมีทางถอยไปโปรแกรมอ่านหน้าจอ
    }
  }

  /** เสียงที่ตรงภาษาที่สุด — null แปลว่าไม่มีเสียงที่เหมาะกับภาษานี้ */
  private voiceFor(tag: string): SpeechSynthesisVoice | null {
    const voices = this.synthesis?.getVoices() ?? []
    const normalize = (lang: string) => lang.replace('_', '-').toLowerCase()
    return (
      voices.find((v) => normalize(v.lang) === tag.toLowerCase()) ??
      voices.find((v) => normalize(v.lang).startsWith(tag.slice(0, 2).toLowerCase())) ??
      null
    )
  }

  cancel() {
    clearTimeout(this.timer)
    this.utterance = null // ตัดการเชื่อมโยงก่อน cancel เพราะ cancel ยิง event ตามมาทีหลัง
    this.current = null
    this.queue = []
    this.synthesis?.cancel()
    this.publish({ speaking: false, text: '' })
  }

  speak(text: string, options: SpeakOptions = {}) {
    if (!text.trim()) return

    const item: QueueItem = { text, options, expires: Date.now() + STALE_AFTER_MS }

    // ข้อความกลุ่มเดียวกันแทนที่ของเดิม เช่นคำสั่งเลี้ยวที่อัปเดตระยะทุกไม่กี่วินาที
    if (options.group) this.queue = this.queue.filter((q) => q.options.group !== options.group)
    if (this.current?.text === text || this.queue.some((q) => q.text === text)) return

    if (options.priority === 'critical') {
      this.queue = this.queue.filter((q) => q.options.priority === 'critical')
      // ตัดข้อความธรรมดาที่กำลังพูดอยู่ แต่ไม่ตัดคำเตือน critical ด้วยกันเอง
      if (this.current && this.current.options.priority !== 'critical') {
        clearTimeout(this.timer)
        this.utterance = null
        this.current = null
        this.synthesis?.cancel()
      }
    }

    this.queue.push(item)
    this.queue = this.queue.slice(-MAX_QUEUE)
    if (!this.current) this.drain()
  }

  private finish() {
    this.utterance = null
    this.current = null
    this.drain()
  }

  private drain() {
    clearTimeout(this.timer)
    const item = this.queue.shift()
    if (!item) {
      this.current = null
      this.publish({ speaking: false })
      return
    }
    if (item.expires < Date.now()) {
      this.drain()
      return
    }

    this.current = item
    const synthesis = this.synthesis
    const tag = LANG_TAG[this.language]
    const voices = synthesis?.getVoices() ?? []
    const voice = this.voiceFor(tag)

    // รายชื่อเสียงโหลดแล้วแต่ไม่มีเสียงของภาษานี้ = อ่านออกมาก็ฟังไม่รู้เรื่อง
    // ให้โปรแกรมอ่านหน้าจออ่านแทนดีกว่า เพราะมันมีเสียงภาษาไทยของระบบอยู่แล้ว
    const canSpeak = synthesis !== null && (voices.length === 0 || voice !== null)
    if (!canSpeak) {
      this.announceViaScreenReader(item)
      return
    }

    const utterance = new SpeechSynthesisUtterance(item.text)
    utterance.lang = tag
    if (voice) utterance.voice = voice
    this.utterance = utterance

    // ถอยไปใช้โปรแกรมอ่านหน้าจอ แล้วประกาศข้อความเดิมซ้ำ เพื่อไม่ให้ข้อความหายไปเฉยๆ
    const fallback = () => {
      if (this.utterance !== utterance) return
      this.utterance = null
      synthesis.cancel()
      this.announceViaScreenReader(item)
    }

    utterance.onstart = () => {
      if (this.utterance !== utterance) return
      clearTimeout(this.timer)
      this.publish({ speaking: true, usingScreenReader: false, text: '' })
      // กันกรณีเครื่องยนต์เสียงค้างกลางประโยคจนไม่ยิง onend
      this.timer = setTimeout(fallback, Math.max(30_000, item.text.length * 200))
    }
    utterance.onend = () => {
      if (this.utterance !== utterance) return
      clearTimeout(this.timer)
      this.finish()
    }
    utterance.onerror = fallback

    this.publish({ speaking: true, text: '' })
    // เงียบไปเฉยๆ โดยไม่ยิง error เกิดขึ้นได้จริงบน iOS ที่ยังไม่ปลดล็อก
    this.timer = setTimeout(fallback, START_DEADLINE_MS)

    try {
      synthesis.resume()
      synthesis.speak(utterance)
    } catch {
      fallback()
    }
  }

  /** ใส่ข้อความลง live region ให้โปรแกรมอ่านหน้าจออ่าน แล้วเว้นจังหวะตามความยาว */
  private announceViaScreenReader(item: QueueItem) {
    this.publish({
      text: item.text,
      sequence: this.snapshot.sequence + 1,
      speaking: true,
      usingScreenReader: true,
    })
    this.timer = setTimeout(() => this.finish(), readerPace(item.text))
  }
}

export const appSpeechService = new AppSpeechService()
