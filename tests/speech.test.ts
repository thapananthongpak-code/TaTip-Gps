import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSpeechService } from '../src/services/impl/appSpeechService'

class Utterance {
  lang = ''
  voice: unknown = null
  volume = 1
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public text: string) {}
}

let spoken: Utterance[]
let service: AppSpeechService

/** ติดตั้งเครื่องยนต์เสียงจำลอง — autoStart=false จำลองเครื่องที่เงียบไปเฉยๆ */
function installSynthesis({ voices = ['th-TH', 'en-US'], autoStart = true } = {}) {
  spoken = []
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speak(u: Utterance) {
        spoken.push(u)
        if (autoStart) setTimeout(() => u.onstart?.(), 0)
      },
      cancel() {},
      resume() {},
      getVoices: () => voices.map((lang) => ({ lang })),
    },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  installSynthesis()
  service = new AppSpeechService()
})

describe('AppSpeechService', () => {
  it('พูดด้วยเสียงของแอปเอง และไม่ใส่ข้อความลง live region ให้อ่านซ้ำ', () => {
    service.speak('เดินตรงไป 50 เมตร')
    vi.advanceTimersByTime(10)

    expect(spoken.map((u) => u.text)).toEqual(['เดินตรงไป 50 เมตร'])
    // สำคัญที่สุด: live region ต้องว่าง ไม่งั้น VoiceOver จะอ่านทับเสียงแอป
    expect(service.getSnapshot().usingScreenReader).toBe(false)
    expect(service.getSnapshot().text).toBe('')
  })

  it('ใช้ภาษาที่ตั้งไว้กับเสียงที่ตรงภาษา', () => {
    service.setLanguage('en')
    service.speak('Turn left')
    expect(spoken[0].lang).toBe('en-US')
  })

  it('เครื่องที่ไม่มีเสียงของภาษานั้น ให้โปรแกรมอ่านหน้าจออ่านแทน แทนที่จะอ่านผิดภาษา', () => {
    installSynthesis({ voices: ['en-US'] })
    service = new AppSpeechService()
    service.setLanguage('th')

    service.speak('เลี้ยวซ้าย')

    expect(spoken).toHaveLength(0)
    expect(service.getSnapshot().usingScreenReader).toBe(true)
    expect(service.getSnapshot().text).toBe('เลี้ยวซ้าย')
  })

  it('เครื่องยนต์เสียงที่เงียบไปเฉยๆ ถูกตรวจจับได้ แล้วถอยไปโปรแกรมอ่านหน้าจอ', () => {
    installSynthesis({ autoStart: false })
    service = new AppSpeechService()

    service.speak('ระวังบันได')
    expect(service.getSnapshot().text).toBe('')

    // ไม่เริ่มพูดภายในกำหนด = ถือว่าใช้ไม่ได้ ข้อความต้องไม่หายไปเฉยๆ
    vi.advanceTimersByTime(3000)
    expect(service.getSnapshot().usingScreenReader).toBe(true)
    expect(service.getSnapshot().text).toBe('ระวังบันได')
  })

  it('เบราว์เซอร์ที่ไม่มี SpeechSynthesis เลย ยังประกาศผ่านโปรแกรมอ่านหน้าจอได้', () => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined })
    service = new AppSpeechService()

    service.speak('ถึงจุดหมายแล้ว')

    expect(service.getSnapshot().usingScreenReader).toBe(true)
    expect(service.getSnapshot().text).toBe('ถึงจุดหมายแล้ว')
  })

  it('ข้อความ critical ตัดข้อความธรรมดาที่กำลังพูดอยู่', () => {
    service.speak('พบเส้นทางแล้ว')
    vi.advanceTimersByTime(10)
    service.speak('ระวัง ข้างหน้ามีบันได', { priority: 'critical' })
    vi.advanceTimersByTime(10)

    expect(spoken.map((u) => u.text)).toEqual(['พบเส้นทางแล้ว', 'ระวัง ข้างหน้ามีบันได'])
  })

  it('คำเตือน critical ไม่ตัดคำเตือน critical ด้วยกันเอง', () => {
    service.speak('ระวังบันได', { priority: 'critical' })
    vi.advanceTimersByTime(10)
    service.speak('ออกนอกเส้นทาง', { priority: 'critical' })
    vi.advanceTimersByTime(10)

    // ตัวที่สองต้องรอให้ตัวแรกพูดจบก่อน
    expect(spoken.map((u) => u.text)).toEqual(['ระวังบันได'])
    spoken[0].onend?.()
    vi.advanceTimersByTime(10)
    expect(spoken.map((u) => u.text)).toEqual(['ระวังบันได', 'ออกนอกเส้นทาง'])
  })

  it('ข้อความกลุ่มเดียวกันแทนที่ของเดิม ไม่สะสมเป็นคิวยาว', () => {
    service.speak('กำลังพูดอยู่')
    vi.advanceTimersByTime(10)
    service.speak('อีก 50 เมตร เลี้ยวซ้าย', { group: 'navigation' })
    service.speak('อีก 20 เมตร เลี้ยวซ้าย', { group: 'navigation' })

    spoken[0].onend?.()
    vi.advanceTimersByTime(10)
    expect(spoken.map((u) => u.text)).toEqual(['กำลังพูดอยู่', 'อีก 20 เมตร เลี้ยวซ้าย'])
  })

  it('ไม่พูดข้อความเดิมซ้ำขณะที่ยังค้างอยู่ในคิว', () => {
    service.speak('เลี้ยวซ้าย')
    service.speak('เลี้ยวซ้าย')
    vi.advanceTimersByTime(10)
    expect(spoken).toHaveLength(1)
  })

  it('cancel ล้างคิวและหยุดทันที', () => {
    service.speak('ข้อความแรก')
    service.speak('ข้อความที่สอง')
    vi.advanceTimersByTime(10)
    service.cancel()

    expect(service.getSnapshot().speaking).toBe(false)
    expect(service.getSnapshot().text).toBe('')
    vi.advanceTimersByTime(20_000)
    expect(spoken.map((u) => u.text)).toEqual(['ข้อความแรก'])
  })

  it('ข้อความว่างไม่ถูกพูด', () => {
    service.speak('   ')
    vi.advanceTimersByTime(10)
    expect(spoken).toHaveLength(0)
  })
})
