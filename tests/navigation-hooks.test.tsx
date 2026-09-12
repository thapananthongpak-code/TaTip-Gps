import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSearch } from '../src/hooks/useSearch'
import { useNavigation } from '../src/hooks/useNavigation'
import type { GeoPosition, Place, Route } from '../src/types'

const mocks = vi.hoisted(() => ({
  speak: vi.fn(),
  route: vi.fn(),
  search: vi.fn(),
  cancel: vi.fn(),
  t: (key: string) => key,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.t }) }))
vi.mock('../src/hooks/useSpeech', () => ({ useSpeech: () => ({ speak: mocks.speak }) }))
vi.mock('../src/i18n', () => ({ currentLanguage: () => 'en' }))
vi.mock('../src/services', () => ({
  routingService: { getWalkingRoute: mocks.route },
  geocodingService: { search: mocks.search },
  speechService: { cancel: mocks.cancel },
  SEARCH_DEBOUNCE_MS: 1000,
}))
const position: GeoPosition = {
  lat: 0,
  lng: 0,
  accuracy: 5,
  heading: null,
  speed: null,
  timestamp: 100000,
}
const place: Place = { id: 'end', name: 'Test', address: '', location: { lat: 0.001, lng: 0.001 } }
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(100000)
  vi.clearAllMocks()
})
afterEach(() => vi.useRealTimers())
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

it('typing does not query public geocoding and edited queries reject old results', async () => {
  const pending = deferred<Place[]>()
  mocks.search.mockReturnValue(pending.promise)
  const { result } = renderHook(() => useSearch(null))
  act(() => result.current.setQuery('Old search'))
  await act(() => vi.advanceTimersByTimeAsync(1200))
  expect(mocks.search).not.toHaveBeenCalled()
  act(() => result.current.search())
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(mocks.search).toHaveBeenCalledTimes(1)
  act(() => result.current.setQuery('New search'))
  await act(async () => {
    pending.resolve([place])
    await pending.promise
  })
  expect(result.current.results).toEqual([])
  expect(result.current.isSearching).toBe(false)
})
it('stopping a route rejects late route and retry callbacks', async () => {
  const pending = deferred<Route>()
  mocks.route.mockReturnValue(pending.promise)
  const { result } = renderHook(() => useNavigation(position, true))
  act(() => result.current.start(place))
  const options = mocks.route.mock.calls[0][2]
  act(() => result.current.stop())
  await act(async () => {
    options.onRetry(1)
    pending.resolve({ id: 'late' } as Route)
    await pending.promise
  })
  expect(result.current.status).toBe('idle')
  expect(result.current.route).toBeNull()
  expect(result.current.retryAttempt).toBe(0)
})
it('unreliable or stale GPS cannot start routing', () => {
  const { result } = renderHook(() => useNavigation({ ...position, accuracy: 80 }, true))
  act(() => result.current.start(place))
  expect(result.current.error?.code).toBe('NO_POSITION')
  expect(mocks.route).not.toHaveBeenCalled()
})
