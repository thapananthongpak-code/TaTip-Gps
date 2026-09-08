import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useGeolocation } from '../src/hooks/useGeolocation'

let success: PositionCallback
let failure: PositionErrorCallback
const fix = (timestamp = Date.now()): GeolocationPosition => ({
  coords: {
    latitude: 13,
    longitude: 100,
    accuracy: 5,
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
      clearWatch: vi.fn(),
    },
  })
})
afterEach(() => vi.useRealTimers())
it('does not request GPS before explicit activation', () => {
  renderHook(() => useGeolocation())
  expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled()
})
it('detects missing first fix even when the browser never calls the error callback', () => {
  const { result } = renderHook(() => useGeolocation())
  act(() => result.current.start())
  act(() => vi.advanceTimersByTime(15001))
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
