import { StrictMode } from 'react'
import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useLiveShare } from '../src/hooks/useLiveShare'
import { useSearch } from '../src/hooks/useSearch'
import { useNavigation } from '../src/hooks/useNavigation'
import { SosButton } from '../src/components/SosButton'
import type { GeoPosition, Place, Route } from '../src/types'

const mocks = vi.hoisted(() => ({
  speak: vi.fn(),
  share: vi.fn(),
  route: vi.fn(),
  search: vi.fn(),
  cancel: vi.fn(),
  t: (key: string) => key,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.t }) }))
vi.mock('../src/hooks/useSpeech', () => ({ useSpeech: () => ({ speak: mocks.speak }) }))
vi.mock('../src/i18n', () => ({ currentLanguage: () => 'en' }))
vi.mock('../src/services', () => ({
  shareService: { share: mocks.share, buildShareUrl: () => 'https://example.test/#/share/fixture' },
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

it('cancelled sharing does not claim success or create a session', async () => {
  mocks.share.mockResolvedValue('unavailable')
  const { result } = renderHook(() =>
    useLiveShare({ position, destination: null, hasArrived: false }),
  )
  await act(() => result.current.start())
  expect(result.current.isSharing).toBe(false)
  expect(mocks.speak).toHaveBeenCalledWith('share.notSent')
})
it('a pending share cannot resurrect a stopped session', async () => {
  const pending = deferred<string>()
  mocks.share.mockReturnValue(pending.promise)
  const { result } = renderHook(() =>
    useLiveShare({ position, destination: null, hasArrived: false }),
  )
  let start!: Promise<void>
  act(() => {
    start = result.current.start()
  })
  act(() => result.current.stop())
  await act(async () => {
    pending.resolve('shared')
    await start
  })
  expect(result.current.session).toBeNull()
  expect(mocks.speak).not.toHaveBeenCalledWith('share.startedSpoken')
})
it('arrival invalidates a pending share result', async () => {
  const pending = deferred<string>()
  mocks.share.mockReturnValue(pending.promise)
  const { result, rerender } = renderHook(
    ({ arrived }) => useLiveShare({ position, destination: place, hasArrived: arrived }),
    { initialProps: { arrived: false } },
  )
  let start!: Promise<void>
  act(() => {
    start = result.current.start()
  })
  rerender({ arrived: true })
  await act(async () => {
    pending.resolve('shared')
    await start
  })
  rerender({ arrived: false })
  expect(result.current.session).toBeNull()
})
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
it('SOS virtual activation works in StrictMode and never sends directly', () => {
  const trigger = vi.fn()
  const view = render(
    <StrictMode>
      <SosButton onTrigger={trigger} vibrationEnabled={false} />
    </StrictMode>,
  )
  fireEvent.click(view.getByRole('button'))
  expect(trigger).toHaveBeenCalledTimes(1)
  expect(mocks.share).not.toHaveBeenCalled()
})

it('holding SOS for three seconds triggers confirmation only once under StrictMode', () => {
  const trigger = vi.fn()
  const view = render(
    <StrictMode>
      <SosButton onTrigger={trigger} vibrationEnabled={false} />
    </StrictMode>,
  )
  const button = view.getByRole('button')
  fireEvent.pointerDown(button)
  act(() => vi.advanceTimersByTime(2999))
  expect(trigger).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(201))
  fireEvent.pointerUp(button)
  fireEvent.click(button)
  expect(trigger).toHaveBeenCalledTimes(1)
  expect(mocks.share).not.toHaveBeenCalled()
})
