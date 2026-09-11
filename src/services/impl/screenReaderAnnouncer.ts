import type {
  SpeakOptions,
  SpeechService,
  SpeechSnapshot,
} from '@/services/interfaces/speechService'

interface QueueItem {
  text: string
  options: SpeakOptions
  expires: number
}

/** ข้อความที่ค้างในคิวนานกว่านี้ถือว่าไม่ทันการณ์แล้ว ทิ้งไปดีกว่าประกาศย้อนหลัง */
const STALE_AFTER_MS = 20_000

/** จำกัดคิวไม่ให้ยาวจนประกาศตามหลังสถานการณ์จริง */
const MAX_QUEUE = 8

/**
 * ประกาศข้อความผ่าน live region ให้โปรแกรมอ่านหน้าจอเป็นผู้อ่าน
 *
 * ทำไมไม่ใช้ SpeechSynthesis เอง: ผู้ใช้กลุ่มนี้เปิด VoiceOver หรือ TalkBack อยู่แล้ว
 * ถ้าแอปสังเคราะห์เสียงซ้อนขึ้นมาอีกชุด จะได้ยินสองเสียงพูดทับกันจนจับใจความไม่ได้
 * และเว็บไม่มี API ให้รู้ว่าโปรแกรมอ่านหน้าจอพูดจบหรือยัง จึงสลับกันพูดให้เรียบร้อยไม่ได้
 *
 * ⚠️ ARIA ไม่มี event บอกว่าอ่านจบแล้ว จึงเว้นจังหวะตามความยาวข้อความแทน
 * และ **ไม่มีทางรู้ว่าผู้ใช้ได้ยินจริงหรือไม่** ห้ามถือว่าประกาศแล้วเท่ากับรับรู้แล้ว
 */
export class ScreenReaderAnnouncer implements SpeechService {
  private queue: QueueItem[] = []
  private current: QueueItem | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private listeners = new Set<() => void>()
  private snapshot: SpeechSnapshot = { text: '', sequence: 0, speaking: false }

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

  cancel() {
    clearTimeout(this.timer)
    this.current = null
    this.queue = []
    this.publish({ speaking: false, text: '' })
  }

  speak(text: string, options: SpeakOptions = {}) {
    if (!text.trim()) return

    const item: QueueItem = { text, options, expires: Date.now() + STALE_AFTER_MS }

    // ข้อความกลุ่มเดียวกันแทนที่ของเดิม เช่นคำสั่งเลี้ยวที่อัปเดตระยะทุกไม่กี่วินาที
    if (options.group) this.queue = this.queue.filter((q) => q.options.group !== options.group)

    // ข้อความเดิมซ้ำติดกันไม่ต้องประกาศซ้ำ
    if (this.current?.text === text || this.queue.some((q) => q.text === text)) return

    if (options.priority === 'critical') {
      this.queue = this.queue.filter((q) => q.options.priority === 'critical')
      // ตัดข้อความธรรมดาที่กำลังประกาศอยู่ แต่ไม่ตัดคำเตือน critical ด้วยกันเอง
      if (this.current && this.current.options.priority !== 'critical') {
        clearTimeout(this.timer)
        this.current = null
      }
    }

    this.queue.push(item)
    this.queue = this.queue.slice(-MAX_QUEUE)
    if (!this.current) this.drain()
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
    this.publish({ text: item.text, sequence: this.snapshot.sequence + 1, speaking: true })

    // เว้นจังหวะตามความยาวข้อความ เพราะ ARIA ไม่บอกว่าอ่านจบเมื่อไหร่
    this.timer = setTimeout(
      () => {
        this.current = null
        this.drain()
      },
      Math.min(12_000, Math.max(2500, item.text.length * 65)),
    )
  }
}

export const screenReaderAnnouncer = new ScreenReaderAnnouncer()
