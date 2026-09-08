import { afterEach, expect, it, vi } from 'vitest'
import { osrmRoutingService } from '../src/services/impl/osrmRoutingService'
const origin = { lat: 0, lng: 0 }
const destination = { id: 'test', name: 'Test', address: '', location: { lat: 0, lng: 0.001 } }
afterEach(() => vi.unstubAllGlobals())
it('provider failure never falls back to a driving endpoint', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('', { status: 403 }))
  vi.stubGlobal('fetch', fetch)
  await expect(osrmRoutingService.getWalkingRoute(origin, destination)).rejects.toMatchObject({
    code: 'PROVIDER_ERROR',
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0][0]).toContain('routing.openstreetmap.de/routed-foot/route/v1/foot/')
})
it.each([
  null,
  { code: 'Ok', routes: [null] },
  {
    code: 'Ok',
    routes: [{ distance: 10, duration: 10, geometry: { coordinates: [[999, 0]] }, legs: [] }],
  },
])('rejects malformed route responses with a provider error', async (data) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 })),
  )
  await expect(osrmRoutingService.getWalkingRoute(origin, destination)).rejects.toMatchObject({
    code: 'PROVIDER_ERROR',
  })
})
