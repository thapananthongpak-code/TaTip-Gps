import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useGeolocation } from '../src/hooks/useGeolocation'

let success: PositionCallback
let failure: PositionErrorCallback
/** callback ของการขอตำแหน่งคร่าวๆ ชั้นแรก */
let coarseOk: PositionCallback
let coarseFail: PositionErrorCallback
let coarseOptions: PositionOptions | undefined
const fix = (timestamp = Date.now(), accuracy = 5): GeolocationPosition => ({
  coords: {
    latitude: 13,
    longitude: 100,
    accuracy,
    heading: null,
    speed: null,
    altitude: null,
    altitudeAccuracy: null,
    toJSON: () => ({}),
  },
  timestamp,
  toJSON: () => ({}),
})
beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
        success = ok
        failure = fail
        return 1
      }),
      getCurrentPosition: vi.fn(
        (ok: PositionCallback, fail: PositionErrorCallback, options?: PositionOptions) => {
          coarseOk = ok
          coarseFail = fail
          coarseOptions = options
        },
      ),
      clearWatch: vi.fn(),
    },
  })
})
afterEach(() => vi.useRealTimers())
it('does not request GPS before explicit activation', () => {
  renderHook(() => useGeolocation())
  expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled()
})
/*
 * เวลารอยาวขึ้นเป็น 45 วินาที เพราะ GPS ที่เพิ่งเปิดเครื่องใช้เวลา 30-60 วินาที
 * แม้อยู่กลางแจ้ง ค่าเดิม 15 วินาทีทำให้ขึ้นว่าหาไม่พบทั้งที่รออีกหน่อยก็ได้
 */
it('detects missing first fix even when the browser never calls the error callback', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  act(() => vi.advanceTimersByTime(20_000))
  expect(result.current.error).toBeNull()
  act(() => vi.advanceTimersByTime(26_000))
  expect(result.current.error?.code).toBe('TIMEOUT')
})
it('detects stale positions and recovers on a fresh fix', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  act(() => success(fix()))
  act(() => vi.advanceTimersByTime(15001))
  expect(result.current.isStale).toBe(true)
  act(() => success(fix()))
  expect(result.current.isStale).toBe(false)
})
it('ignores callbacks from a watch which was stopped', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  const oldSuccess = success
  act(() => result.current.stop())
  act(() => oldSuccess(fix()))
  expect(result.current.position).toBeNull()
})
it('permission denial is an explicit error, not an indefinitely acquiring state', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  act(() =>
    failure({
      code: 1,
      message: 'denied',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    }),
  )
  expect(result.current.error?.code).toBe('PERMISSION_DENIED')
})

/* ---------- ขอตำแหน่งสองชั้น สำหรับตอนอยู่ในอาคาร ---------- */

/*
 * ในอาคาร สัญญาณดาวเทียมถูกหลังคาบังเกือบหมด การขอแบบความแม่นยำสูงอย่างเดียว
 * จึงรอจนหมดเวลาแล้วขึ้นว่าหาตำแหน่งไม่พบ ทั้งที่เครื่องเดาตำแหน่งจาก WiFi
 * และเสาสัญญาณได้ภายในไม่กี่วินาที
 */
it('ขอตำแหน่งคร่าวๆ ควบคู่ไปด้วย โดยยอมให้ใช้ WiFi และเสาสัญญาณ', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())

  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled()
  expect(coarseOptions?.enableHighAccuracy).toBe(false)
  // ยอมรับตำแหน่งที่เพิ่งจับได้ ไม่บังคับรอจับใหม่สดๆ
  expect(coarseOptions?.maximumAge).toBeGreaterThan(0)
})

it('ตำแหน่งคร่าวๆ ทำให้มีตำแหน่งใช้ได้ทันทีโดยไม่ต้องรอดาวเทียม', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  act(() => coarseOk(fix(Date.now(), 80)))

  expect(result.current.position?.accuracy).toBe(80)
  expect(result.current.status).toBe('tracking')
  // ความแม่นยำ 80 เมตรยังไม่ดีพอ แผงสถานะต้องบอกว่าสัญญาณอ่อน
  expect(result.current.isPoorAccuracy).toBe(true)
})

/** ตำแหน่งที่แม่นยำกว่ามาทีหลังต้องแทนที่ของคร่าวๆ ได้ */
it('ตำแหน่งจากดาวเทียมที่แม่นกว่าเข้ามาแทนที่ของคร่าวๆ', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  act(() => coarseOk(fix(Date.now(), 80)))
  act(() => success(fix(Date.now(), 6)))

  expect(result.current.position?.accuracy).toBe(6)
  expect(result.current.isPoorAccuracy).toBe(false)
})

/*
 * ตำแหน่งคร่าวๆ ที่มาช้ากว่าห้ามเขียนทับตำแหน่งที่แม่นยำกว่า
 * ไม่งั้นความแม่นยำที่แสดงจะกระโดดแย่ลงเองโดยไม่มีเหตุผล
 */
it('ตำแหน่งคร่าวๆ ที่มาช้าไม่เขียนทับตำแหน่งที่ดีกว่า', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  act(() => success(fix(Date.now(), 6)))
  act(() => coarseOk(fix(Date.now(), 120)))

  expect(result.current.position?.accuracy).toBe(6)
})

/*
 * เมื่อมีตำแหน่งคร่าวๆ อยู่แล้ว การที่ดาวเทียมยังจับไม่ได้ไม่ใช่ความล้มเหลว
 * ยังมีตำแหน่งให้ใช้ค้นหาและแสดงบนแผนที่ แค่ยังไม่แม่นพอจะนำทาง
 */
it('ดาวเทียมจับไม่ได้ แต่มีตำแหน่งคร่าวๆ แล้ว ต้องไม่ขึ้นว่าผิดพลาด', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  act(() => coarseOk(fix(Date.now(), 90)))
  act(() => failure({ code: 3, message: 'timeout' } as GeolocationPositionError))

  expect(result.current.error).toBeNull()
  expect(result.current.position).not.toBeNull()
})

/** การถูกปฏิเสธสิทธิ์ต้องแจ้งเสมอ แม้มีตำแหน่งคร่าวๆ อยู่แล้ว */
it('ถูกปฏิเสธสิทธิ์ต้องแจ้งเสมอ', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  act(() => coarseOk(fix(Date.now(), 90)))
  act(() => failure({ code: 1, message: 'denied' } as GeolocationPositionError))

  expect(result.current.error?.code).toBe('PERMISSION_DENIED')
})

/** ตำแหน่งคร่าวๆ หาไม่ได้ ต้องไม่ทำให้แอปขึ้นว่าผิดพลาด ตัวหลักยังทำงานอยู่ */
it('ตำแหน่งคร่าวๆ ล้มเหลวเงียบๆ ไม่รบกวนผู้ใช้', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  act(() => coarseFail({ code: 2, message: 'unavailable' } as GeolocationPositionError))

  expect(result.current.error).toBeNull()
  expect(result.current.status).toBe('acquiring')
})
