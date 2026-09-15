import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlertSound } from '../src/utils/alertSound'

/** จำลอง Web Audio API เท่าที่ตัวส่งเสียงใช้จริง */
function installAudio() {
  const oscillator = {
    type: '',
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
  const gain = {
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  const context = {
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
  }
  /*
   * ต้องเป็นคลาส ไม่ใช่ arrow function
   * โค้ดจริงเรียกด้วย new AudioContext() ซึ่ง arrow function ใช้เป็นตัวสร้างไม่ได้
   */
  class FakeAudioContext {
    constructor() {
      return context as unknown as FakeAudioContext
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return { oscillator, gain, context }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('AlertSound', () => {
  it('กดแล้วเริ่มส่งเสียงทันที', () => {
    const audio = installAudio()
    const alert = new AlertSound()
    alert.start()

    expect(audio.oscillator.start).toHaveBeenCalled()
    expect(alert.getSnapshot()).toBe(true)
  })

  /** iOS พัก AudioContext ไว้จนกว่าจะมีการแตะ การกดปุ่มนี้คือการแตะนั้น */
  it('ปลุก AudioContext ที่ถูกพักไว้', () => {
    const audio = installAudio()
    new AlertSound().start()
    expect(audio.context.resume).toHaveBeenCalled()
  })

  /** เสียงสลับระดับสังเกตได้ง่ายกว่าเสียงระดับเดียวที่กลืนไปกับเสียงรอบข้าง */
  it('สลับระดับเสียงไปมาระหว่างส่งเสียง', () => {
    const audio = installAudio()
    const alert = new AlertSound()
    alert.start()
    const before = audio.oscillator.frequency.setValueAtTime.mock.calls.length

    vi.advanceTimersByTime(2000)

    expect(audio.oscillator.frequency.setValueAtTime.mock.calls.length).toBeGreaterThan(before)
    const used = new Set(
      audio.oscillator.frequency.setValueAtTime.mock.calls.map((c) => c[0] as number),
    )
    expect(used.size).toBeGreaterThan(1)
  })

  /*
   * ต้องมีเพดานเวลา เพราะผู้ใช้ที่มองไม่เห็นอาจกดโดยไม่ตั้งใจแล้วหาปุ่มหยุดไม่เจอ
   * เสียงดังกลางที่สาธารณะที่ไม่มีใครปิดได้คือสถานการณ์ที่แก้ลำบาก
   */
  it('หยุดเองภายในหนึ่งนาที', () => {
    const audio = installAudio()
    const alert = new AlertSound()
    alert.start()

    vi.advanceTimersByTime(59_000)
    expect(alert.getSnapshot()).toBe(true)

    vi.advanceTimersByTime(2_000)
    expect(alert.getSnapshot()).toBe(false)
    expect(audio.oscillator.stop).toHaveBeenCalled()
  })

  it('กดซ้ำเพื่อหยุดได้ และหยุดแล้วต้องเงียบจริง', () => {
    const audio = installAudio()
    const alert = new AlertSound()
    alert.start()
    alert.stop()

    expect(alert.getSnapshot()).toBe(false)
    expect(audio.oscillator.stop).toHaveBeenCalled()
    expect(audio.oscillator.disconnect).toHaveBeenCalled()

    // ตัวจับเวลาที่ค้างต้องถูกล้าง ไม่งั้นจะมีเสียงโผล่มาเองทีหลัง
    const calls = audio.oscillator.frequency.setValueAtTime.mock.calls.length
    vi.advanceTimersByTime(5000)
    expect(audio.oscillator.frequency.setValueAtTime.mock.calls.length).toBe(calls)
  })

  it('กดเริ่มซ้ำขณะที่ส่งเสียงอยู่ ไม่สร้างเสียงซ้อนกัน', () => {
    const audio = installAudio()
    const alert = new AlertSound()
    alert.start()
    alert.start()
    expect(audio.context.createOscillator).toHaveBeenCalledTimes(1)
  })

  it('แจ้ง component ทุกครั้งที่สถานะเปลี่ยน', () => {
    installAudio()
    const alert = new AlertSound()
    const listener = vi.fn()
    alert.subscribe(listener)

    alert.start()
    alert.stop()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  /** เบราว์เซอร์ที่ทำไม่ได้ ต้องบอกตรงๆ ไม่ใช่มีปุ่มที่กดแล้วเงียบ */
  it('บอกว่าทำไม่ได้เมื่อเบราว์เซอร์ไม่มี Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined)
    const alert = new AlertSound()
    expect(alert.isSupported).toBe(false)
    alert.start()
    expect(alert.getSnapshot()).toBe(false)
  })

  /** สร้างเสียงพังต้องไม่ทำให้แอปทั้งตัวล้ม */
  it('สร้างเสียงไม่สำเร็จก็ไม่พัง', () => {
    class BlockedAudioContext {
      constructor() {
        throw new Error('blocked')
      }
    }
    vi.stubGlobal('AudioContext', BlockedAudioContext)
    const alert = new AlertSound()
    expect(() => alert.start()).not.toThrow()
    expect(alert.getSnapshot()).toBe(false)
  })
})
