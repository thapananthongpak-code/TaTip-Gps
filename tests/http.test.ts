import { afterEach, expect, it, vi } from 'vitest'
import { fetchJson } from '../src/services/impl/httpClient'
import { createRateLimiter } from '../src/services/impl/requestQueue'
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('honors Retry-After and schedules retries as separate network attempts', async () => {
  vi.useFakeTimers()
  const times: number[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      times.push(Date.now())
      return Promise.resolve(
        times.length === 1
          ? new Response('', { status: 429, headers: { 'Retry-After': '3' } })
          : new Response('{"ok":true}'),
      )
    }),
  )
  const result = fetchJson('/test', { schedule: createRateLimiter(1100) })
  await vi.advanceTimersByTimeAsync(3001)
  expect(await result).toEqual({ ok: true })
  expect(times[1] - times[0]).toBeGreaterThanOrEqual(3000)
})
it('cancels during backoff without issuing another request', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
  const pending = fetchJson('/test', { signal: controller.signal })
  const check = expect(pending).rejects.toMatchObject({ code: 'ABORTED' })
  await vi.advanceTimersByTimeAsync(1)
  controller.abort()
  await check
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('treats malformed JSON as provider error, not a retryable network outage', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>bad</html>')))
  await expect(fetchJson('/test')).rejects.toMatchObject({
    code: 'PROVIDER_ERROR',
    retryable: false,
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})
