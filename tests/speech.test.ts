import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScreenReaderAnnouncer } from '../src/services/impl/screenReaderAnnouncer'

let announcer: ScreenReaderAnnouncer

beforeEach(() => {
  vi.useFakeTimers()
  announcer = new ScreenReaderAnnouncer()
})

describe('ScreenReaderAnnouncer', () => {
  it('ประกาศข้อความผ่าน snapshot โดยไม่แตะ SpeechSynthesis เลย', () => {
    // ไม่ stub speechSynthesis ไว้เลย ถ้าโค้ดเผลอเรียกจะพังทันที
    announcer.speak('เดินตรงไป 50 เมตร')
    expect(announcer.getSnapshot().text).toBe('เดินตรงไป 50 เมตร')
    expect(announcer.getSnapshot().speaking).toBe(true)
  })

  it('เพิ่ม sequence ทุกครั้ง เพื่อให้ live region อ่านซ้ำแม้ข้อความเดิม', () => {
    announcer.speak('ระวังบันได')
    const first = announcer.getSnapshot().sequence
    vi.advanceTimersByTime(20_000)
    announcer.speak('ระวังบันได')
    expect(announcer.getSnapshot().sequence).toBeGreaterThan(first)
  })

  it('ไม่ประกาศข้อความเดิมซ้ำขณะที่ยังค้างอยู่ในคิว', () => {
    const seen: string[] = []
    announcer.subscribe(() => seen.push(announcer.getSnapshot().text))
    announcer.speak('เลี้ยวซ้าย')
    announcer.speak('เลี้ยวซ้าย')
    expect(seen.filter((text) => text === 'เลี้ยวซ้าย')).toHaveLength(1)
  })

  it('ข้อความ critical ตัดคิวข้อความธรรมดาที่กำลังประกาศอยู่', () => {
    announcer.speak('พบเส้นทางแล้ว')
    announcer.speak('ระวัง ข้างหน้ามีบันได', { priority: 'critical' })
    expect(announcer.getSnapshot().text).toBe('ระวัง ข้างหน้ามีบันได')
  })

  it('คำเตือน critical ไม่ตัดคำเตือน critical ด้วยกันเอง', () => {
    announcer.speak('ระวังบันได', { priority: 'critical' })
    announcer.speak('ออกนอกเส้นทาง', { priority: 'critical' })
    // ตัวแรกต้องได้ประกาศจนครบจังหวะก่อน ไม่ถูกตัดกลางคัน
    expect(announcer.getSnapshot().text).toBe('ระวังบันได')
    vi.advanceTimersByTime(12_000)
    expect(announcer.getSnapshot().text).toBe('ออกนอกเส้นทาง')
  })

  it('ข้อความกลุ่มเดียวกันแทนที่ของเดิม ไม่สะสมเป็นคิวยาว', () => {
    announcer.speak('กำลังประกาศ')
    announcer.speak('อีก 50 เมตร เลี้ยวซ้าย', { group: 'navigation' })
    announcer.speak('อีก 20 เมตร เลี้ยวซ้าย', { group: 'navigation' })
    vi.advanceTimersByTime(12_000)
    expect(announcer.getSnapshot().text).toBe('อีก 20 เมตร เลี้ยวซ้าย')
  })

  it('ทิ้งข้อความที่ค้างนานเกินไป แทนที่จะประกาศย้อนหลังตอนที่ไม่ทันการณ์แล้ว', () => {
    // ข้อความยาวใช้เวลาประกาศนานสุด 12 วินาที สองข้อความจึงกินเวลาเกินอายุของข้อความที่สาม
    const long = 'ก'.repeat(200)
    announcer.speak(long + '1')
    announcer.speak(long + '2')
    announcer.speak('ข้อความที่ค้างจนไม่ทันการณ์')

    vi.advanceTimersByTime(30_000)
    expect(announcer.getSnapshot().text).not.toBe('ข้อความที่ค้างจนไม่ทันการณ์')
    expect(announcer.getSnapshot().speaking).toBe(false)
  })

  it('cancel ล้างคิวและหยุดประกาศทันที', () => {
    announcer.speak('ข้อความแรก')
    announcer.speak('ข้อความที่สอง')
    announcer.cancel()
    expect(announcer.getSnapshot().text).toBe('')
    expect(announcer.getSnapshot().speaking).toBe(false)
    vi.advanceTimersByTime(20_000)
    expect(announcer.getSnapshot().text).toBe('')
  })

  it('ข้อความว่างไม่ถูกประกาศ', () => {
    announcer.speak('   ')
    expect(announcer.getSnapshot().sequence).toBe(0)
  })
})
