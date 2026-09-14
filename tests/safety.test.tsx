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
