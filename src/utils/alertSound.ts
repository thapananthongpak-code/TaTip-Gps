/** ความถี่สองระดับที่สลับไปมา — เสียงสลับระดับสังเกตได้ง่ายกว่าเสียงระดับเดียว */
const TONE_HZ = [880, 1180] as const

/** สลับระดับเสียงทุกกี่มิลลิวินาที */
const SWITCH_MS = 480

/**
 * หยุดเองหลังกี่มิลลิวินาที
 *
 * ต้องมีเพดาน เพราะผู้ใช้ที่มองไม่เห็นอาจกดโดยไม่ตั้งใจแล้วหาปุ่มหยุดไม่เจอ
 * หนึ่งนาทีนานพอให้คนรอบข้างเดินมาถึง แต่ไม่นานจนกลายเป็นเสียงรบกวนที่ไม่มีใครปิดได้
 */
const MAX_DURATION_MS = 60_000

/** ระดับความดัง — ดังพอให้ได้ยินในที่มีเสียงรบกวน แต่ไม่ถึงขั้นทำร้ายหูคนกด */
const VOLUME = 0.55

type Listener = () => void

/**
 * เสียงขอความช่วยเหลือ ให้คนรอบข้างได้ยิน
 *
 * สร้างเสียงเองด้วย Web Audio API ไม่โหลดไฟล์เสียง เพราะไฟล์เสียงต้องรอโหลด
 * ซึ่งในจังหวะที่ต้องการความช่วยเหลือ การรอเน็ตคือสิ่งที่รับไม่ได้
 * และแอปต้องส่งเสียงนี้ได้แม้ตอนออฟไลน์
 *
 * ⚠️ ไม่ใช่การแจ้งเหตุฉุกเฉิน ไม่ได้ติดต่อใครและไม่ได้ส่งตำแหน่งไปไหน
 * เป็นเพียงเสียงที่ดังขึ้นตรงที่ผู้ใช้ยืนอยู่ ถ้าไม่มีคนอยู่แถวนั้นก็ไม่มีใครได้ยิน
 */
export class AlertSound {
  private context: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private gain: GainNode | null = null
  private switcher: ReturnType<typeof setInterval> | undefined
  private stopper: ReturnType<typeof setTimeout> | undefined
  private playing = false
  private listeners = new Set<Listener>()

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.playing

  /** true เมื่อเบราว์เซอร์สร้างเสียงเองไม่ได้ ปุ่มจะได้ไม่หลอกว่ากดแล้วมีเสียง */
  get isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.AudioContext === 'function'
  }

  private publish() {
    this.listeners.forEach((listener) => listener())
  }

  start(): void {
    if (this.playing || !this.isSupported) return

    try {
      this.context ??= new AudioContext()
      // iOS พัก AudioContext ไว้จนกว่าจะมีการแตะของผู้ใช้ ซึ่งการกดปุ่มนี้คือการแตะนั้น
      void this.context.resume()

      const oscillator = this.context.createOscillator()
      const gain = this.context.createGain()

      // คลื่นสี่เหลี่ยมมีเสียงหวนแหลมที่ตัดผ่านเสียงรถและเสียงพูดได้ดีกว่าคลื่นนุ่ม
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(TONE_HZ[0], this.context.currentTime)

      // ไล่ระดับขึ้นสั้นๆ กันเสียง "ป๊อก" ตอนเริ่ม ซึ่งดังและน่าตกใจกว่าตัวเสียงเอง
      gain.gain.setValueAtTime(0, this.context.currentTime)
      gain.gain.linearRampToValueAtTime(VOLUME, this.context.currentTime + 0.05)

      oscillator.connect(gain)
      gain.connect(this.context.destination)
      oscillator.start()

      this.oscillator = oscillator
      this.gain = gain
      this.playing = true

      let high = false
      this.switcher = setInterval(() => {
        high = !high
        this.oscillator?.frequency.setValueAtTime(
          TONE_HZ[high ? 1 : 0],
          this.context?.currentTime ?? 0,
        )
      }, SWITCH_MS)

      this.stopper = setTimeout(() => this.stop(), MAX_DURATION_MS)
      this.publish()
    } catch {
      // สร้างเสียงไม่ได้ก็ต้องไม่ทำให้แอปทั้งตัวพัง ปุ่มจะอยู่ในสถานะไม่เล่นเสียงตามเดิม
      this.playing = false
      this.publish()
    }
  }

  stop(): void {
    clearInterval(this.switcher)
    clearTimeout(this.stopper)
    this.switcher = undefined
    this.stopper = undefined

    try {
      this.oscillator?.stop()
      this.oscillator?.disconnect()
      this.gain?.disconnect()
    } catch {
      // หยุดซ้ำหรือหยุดตัวที่จบไปแล้วไม่ใช่ข้อผิดพลาดที่ต้องรายงาน
    }

    this.oscillator = null
    this.gain = null
    if (this.playing) {
      this.playing = false
      this.publish()
    }
  }
}

export const alertSound = new AlertSound()
