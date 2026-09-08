import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { webShareService } from '../src/services/impl/webShareService'
import { localSettingsService } from '../src/services/impl/localSettingsService'
import { DEFAULT_SETTINGS } from '../src/types'
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(100000)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
const payload = {
  position: { lat: 13, lng: 100 },
  accuracy: 5,
  capturedAt: 100000,
  expiresAt: 160000,
}
it('snapshot parsing expires while time advances', () => {
  const url = webShareService.buildShareUrl(payload)
  expect(webShareService.parseShareUrl(url)).toEqual(payload)
  vi.advanceTimersByTime(60001)
  expect(webShareService.parseShareUrl(url)).toBeNull()
})
it('rejects malformed, out-of-range and oversized share payloads', () => {
  for (const bad of [
    { ...payload, position: { lat: 91, lng: 100 } },
    { ...payload, accuracy: -1 },
    { ...payload, expiresAt: 999999999 },
  ]) {
    expect(webShareService.parseShareUrl(webShareService.buildShareUrl(bad))).toBeNull()
  }
  expect(
    webShareService.parseShareUrl('https://example.test/#/share/' + 'x'.repeat(7000)),
  ).toBeNull()
})
it('invalid saved contacts cannot be loaded as emergency recipients', () => {
  localStorage.setItem(
    'taathip.settings',
    JSON.stringify({ emergencyContacts: [{ id: '1', name: 'Friend', phone: 'sms:123&body=bad' }] }),
  )
  expect(localSettingsService.load().emergencyContacts).toEqual([])
})
it('storage failures are reported instead of promising contacts were saved or deleted', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full')
  })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(localSettingsService.save(DEFAULT_SETTINGS)).toBe(false)
  expect(localSettingsService.clear()).toBe(false)
})
