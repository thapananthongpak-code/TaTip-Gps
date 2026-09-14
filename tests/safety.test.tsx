import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useNavigation } from '../src/hooks/useNavigation'
import { useNavigationAnnouncer } from '../src/hooks/useNavigationAnnouncer'
import { useWakeLock } from '../src/hooks/useWakeLock'
import type { GeoPosition, Place, Route, UseNavigationResult } from '../src/types'

const mocks = vi.hoisted(() => ({ route: vi.fn(), cancel: vi.fn(), speak: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}))
vi.mock('../src/i18n', () => ({ currentLanguage: () => 'en' }))
vi.mock('../src/hooks/useSpeech', () => ({ useSpeech: () => ({ speak: mocks.speak }) }))
vi.mock('../src/services', async () => {
  const actual = await vi.importActual<typeof import('../src/services')>('../src/services')
  return {
    ...actual,
    routingService: { getWalkingRoute: mocks.route },
    speechService: { cancel: mocks.cancel },
  }
})

const place: Place = { id: 'end', name: 'T', address: '', location: { lat: 0, lng: 0.0009 } }
const A = { lat: 0, lng: 0 }
const B = { lat: 0, lng: 0.0009 }

/** ทางตรงยาว 100 เมตร สองขั้นตอน — สั้นที่สุดที่ยังนำทางได้จริง */
const route = {
  id: 'r1',
  distance: 100,
  duration: 80,
  geometry: [A, B],
  destination: place,
  steps: [
    {
      id: 's0',
      maneuver: 'depart',
      location: A,
      distance: 100,
      duration: 80,
      geometry: [A, B],
      streetName: 'X',
      hazard: null,
    },
    {
      id: 's1',
      maneuver: 'arrive',
      location: B,
      distance: 0,
      duration: 0,
      geometry: [B],
      streetName: null,
      hazard: null,
    },
  ],
} as unknown as Route

const fix = (lng: number, accuracy: number, t: number): GeoPosition => ({
  lat: 0,
  lng,
  accuracy,
  heading: null,
  speed: null,
  timestamp: t,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(100000)
  vi.clearAllMocks()
})
afterEach(() => vi.useRealTimers())

/** เดินจากต้นทางจนเลยปลายทาง ทีละ 10 เมตร ที่ความแม่นยำ GPS ค่าหนึ่ง */
async function walkToEnd(accuracy: number) {
  mocks.route.mockResolvedValue(route)
  const { result, rerender } = renderHook(({ p }) => useNavigation(p, true), {
    initialProps: { p: fix(0, accuracy, 100000) },
  })
  act(() => result.current.start(place))
  await act(() => vi.advanceTimersByTimeAsync(10))
  for (let m = 10; m <= 120; m += 10) {
    rerender({ p: fix(m * 0.000009, accuracy, 100000 + m) })
    await act(() => vi.advanceTimersByTimeAsync(1))
  }
  return result.current.status
}

/*
 * เกณฑ์ประกาศถึงจุดหมายต้องไม่เข้มกว่าเกณฑ์ที่ยอมให้นำทาง
 *
 * เคยตั้งไว้ที่ 15 เมตรขณะที่นำทางได้ถึง 30 เมตร ผลคือในเมืองที่ GPS แม่นราว
 * 20 เมตร ผู้ใช้เดินถึงที่หมายแล้วแต่แอปค้างอยู่สถานะ "กำลังนำทาง" ตลอดไป
 * ไม่ประกาศว่าถึง และไม่ขึ้นปุ่มจบการเดินทาง
 */
it('ประกาศถึงจุดหมายได้ทุกระดับความแม่นยำที่ยังยอมให้นำทาง', async () => {
  expect(await walkToEnd(10)).toBe('arrived')
  expect(await walkToEnd(20)).toBe('arrived')
  expect(await walkToEnd(28)).toBe('arrived')
})

/*
 * ระหว่างหลงทาง คำแนะนำรายขั้นตอนถูกปิดทั้งหมดและการคำนวณเส้นทางใหม่ถูกจำกัด
 * ไม่ให้ถี่กว่า 30 วินาที ถ้าเตือนแค่ครั้งเดียวผู้ใช้ที่มองไม่เห็นจะเจอความเงียบยาว
 * ซึ่งแยกไม่ออกจากการที่แอปหยุดทำงาน
 */
it('ย้ำคำเตือนออกนอกเส้นทางเป็นระยะ ไม่ใช่เตือนครั้งเดียวแล้วเงียบ', () => {
  const nav = {
    status: 'navigating',
    isOffRoute: true,
    suspended: false,
    isRecalculating: false,
    route: null,
    progress: null,
    destination: null,
    error: null,
    arrivalOffset: null,
    retryAttempt: 0,
  } as unknown as UseNavigationResult

  renderHook(() => useNavigationAnnouncer(nav, true))
  const offRoute = () => mocks.speak.mock.calls.filter((c) => c[0] === 'nav.offRouteSpoken').length

  expect(offRoute()).toBe(1)
  act(() => void vi.advanceTimersByTime(21_000))
  expect(offRoute()).toBe(2)
  act(() => void vi.advanceTimersByTime(21_000))
  expect(offRoute()).toBe(3)
})

/** กลับเข้าเส้นทางแล้วต้องหยุดย้ำทันที ไม่ค้างเตือนต่อ */
it('หยุดย้ำเมื่อกลับเข้าเส้นทางแล้ว', () => {
  const base = {
    status: 'navigating',
    suspended: false,
    isRecalculating: false,
    route: null,
    progress: null,
    destination: null,
    error: null,
    arrivalOffset: null,
    retryAttempt: 0,
  }
  const { rerender } = renderHook(
    ({ off }) =>
      useNavigationAnnouncer({ ...base, isOffRoute: off } as unknown as UseNavigationResult, true),
    { initialProps: { off: true } },
  )
  rerender({ off: false })
  const before = mocks.speak.mock.calls.length
  act(() => void vi.advanceTimersByTime(60_000))
  expect(mocks.speak.mock.calls.length).toBe(before)
})

/*
 * ผู้ใช้ที่มองไม่เห็นไม่มีเหตุผลจะแตะหน้าจอระหว่างเดิน เครื่องจึงล็อกตัวเองเสมอ
 * เมื่อหน้าจอดับ แอปจะพักการนำทางแล้วเงียบไปตลอดทางที่เหลือ
 * การจองไม่ให้จอดับจึงไม่ใช่ลูกเล่น แต่เป็นเงื่อนไขที่ทำให้การนำทางทำงานได้จริง
 */
it('จองไม่ให้หน้าจอดับตลอดการเดินทาง และคืนเมื่อจบ', async () => {
  const release = vi.fn().mockResolvedValue(undefined)
  const request = vi.fn().mockResolvedValue({ release, addEventListener: vi.fn() })
  vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } })

  const { rerender, unmount } = renderHook(({ on }) => useWakeLock(on), {
    initialProps: { on: false },
  })
  expect(request).not.toHaveBeenCalled()

  rerender({ on: true })
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(request).toHaveBeenCalledWith('screen')

  // จบการเดินทางแล้วต้องคืน ไม่ใช่กินแบตค้างไว้
  unmount()
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(release).toHaveBeenCalled()
  vi.unstubAllGlobals()
})

/** เบราว์เซอร์ที่ไม่รองรับต้องไม่ทำให้แอปพัง เพราะเป็นแค่ตัวช่วย ไม่ใช่แกนหลัก */
it('ไม่พังบนเบราว์เซอร์ที่ไม่รองรับการจองหน้าจอ', async () => {
  vi.stubGlobal('navigator', { ...navigator, wakeLock: undefined })
  expect(() => renderHook(() => useWakeLock(true))).not.toThrow()
  await act(() => vi.advanceTimersByTimeAsync(1))
  vi.unstubAllGlobals()
})

/* ---------- ตรวจว่ากำลังเดินห่างจากจุดหมาย ---------- */

const ORIGIN = { lat: 13.7455, lng: 100.5341 }
const FAR_END = { lat: 13.7455, lng: 100.5431 } // ตรงไปทางตะวันออก ~970 ม.
const farPlace: Place = { id: 'far', name: 'ปลายทาง', address: '', location: FAR_END }
const longRoute = {
  id: 'r-long',
  distance: 970,
  duration: 780,
  geometry: [ORIGIN, FAR_END],
  destination: farPlace,
  origin: ORIGIN,
  steps: [
    {
      id: '0',
      maneuver: 'depart',
      location: ORIGIN,
      distance: 970,
      duration: 780,
      geometry: [ORIGIN, FAR_END],
    },
    {
      id: '1',
      maneuver: 'arrive',
      location: FAR_END,
      distance: 0,
      duration: 0,
      geometry: [FAR_END],
    },
  ],
} as unknown as Route

/** ตำแหน่งที่ระยะ m เมตรจากจุดเริ่มต้น ไปตามแนวเส้นทาง */
const along = (m: number, accuracy = 5, jitterM = 0): GeoPosition => ({
  lat: ORIGIN.lat + jitterM * 0.000009,
  lng: ORIGIN.lng + m * 0.00000922,
  accuracy,
  heading: null,
  speed: null,
  timestamp: 100000 + m,
})

async function walkThrough(points: GeoPosition[]) {
  mocks.route.mockResolvedValue(longRoute)
  const { result, rerender } = renderHook(({ p }) => useNavigation(p, true), {
    initialProps: { p: along(0) },
  })
  act(() => result.current.start(farPlace))
  await act(() => vi.advanceTimersByTimeAsync(10))
  const flags: boolean[] = []
  for (const point of points) {
    rerender({ p: point })
    await act(() => vi.advanceTimersByTimeAsync(1))
    flags.push(result.current.isMovingAway)
  }
  return flags
}

/*
 * การเตือนผิดอันตรายพอๆ กับการไม่เตือน
 * ถ้าแอปบอกว่า "กำลังเดินห่างจากจุดหมาย" ทั้งที่เดินถูกทาง ผู้ใช้จะหยุดกลางทาง
 * และเลิกเชื่อคำเตือนนั้นในครั้งต่อไป ซึ่งทำให้คำเตือนที่ถูกต้องไร้ความหมายไปด้วย
 */
it('เดินถูกทางต่อเนื่อง ต้องไม่เตือนเลยแม้แต่ครั้งเดียว', async () => {
  const flags = await walkThrough([50, 100, 150, 200, 300, 400, 500].map((m) => along(m)))
  expect(flags.some(Boolean)).toBe(false)
})

/** GPS ในเมืองแกว่งตลอดเวลา ความแกว่งต้องไม่ถูกตีความว่าเดินผิดทาง */
it('เดินถูกทางแต่ GPS แกว่งข้างทาง ก็ต้องไม่เตือน', async () => {
  const jitter = [10, -12, 8, -15, 11, -9, 13]
  const flags = await walkThrough(
    [40, 80, 120, 160, 200, 240, 280].map((m, i) => along(m, 20, jitter[i])),
  )
  expect(flags.some(Boolean)).toBe(false)
})

/** ยืนนิ่งรอข้ามถนนหรือรอคนช่วย ไม่ใช่การเดินผิดทาง */
it('ยืนอยู่กับที่ ต้องไม่เตือน', async () => {
  const flags = await walkThrough(Array.from({ length: 8 }, () => along(200, 15)))
  expect(flags.some(Boolean)).toBe(false)
})

/*
 * กรณีที่ระบบตรวจออกนอกเส้นทางจับไม่ได้เลย
 * หันกลับเดินย้อนบนถนนเส้นเดิม ระยะห่างจากเส้นทางยังเป็นศูนย์ตลอด
 * วัดแล้วเดินย้อนได้ถึง 450 เมตรโดยแอปไม่เคยเอ่ยอะไร
 */
it('หันกลับเดินย้อนบนเส้นทางเดิม ต้องเตือน', async () => {
  const flags = await walkThrough([500, 450, 400, 350, 300].map((m) => along(m)))
  expect(flags.at(-1)).toBe(true)
  expect(flags.filter(Boolean).length).toBeGreaterThan(0)
})

/** เดินผิดทางตั้งแต่ก้าวแรก ต้องจับได้โดยไม่ต้องรอให้ไปไกล */
it('เดินผิดทางตั้งแต่ต้น จับได้ภายในระยะที่ยังเดินกลับไหว', async () => {
  const back = (m: number): GeoPosition => ({
    lat: ORIGIN.lat,
    lng: ORIGIN.lng - m * 0.00000922,
    accuracy: 5,
    heading: null,
    speed: null,
    timestamp: 100000 + m,
  })
  const flags = await walkThrough([10, 20, 30, 40, 50].map(back))
  const firstWarn = flags.indexOf(true)
  expect(firstWarn).toBeGreaterThanOrEqual(0)
  // ต้องเตือนก่อนเดินผิดทางเกิน 50 เมตร
  expect([10, 20, 30, 40, 50][firstWarn]).toBeLessThanOrEqual(50)
})

/** กลับเข้าทางถูกแล้วต้องเลิกเตือน ไม่ค้างเตือนไปตลอดทาง */
it('กลับมาเดินถูกทาง ต้องเลิกเตือน', async () => {
  const flags = await walkThrough([
    ...[500, 450, 400, 350, 300].map((m) => along(m)),
    ...[350, 420, 500, 600].map((m) => along(m)),
  ])
  expect(flags.at(-1)).toBe(false)
})
