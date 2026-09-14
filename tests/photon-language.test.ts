import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { photonGeocodingService } from '../src/services/impl/photonGeocodingService'

/** จับ URL ที่ถูกยิงออกไปจริง เพื่อดูว่าส่งพารามิเตอร์ภาษาไปหรือไม่ */
function stubFetch() {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      features: [
        {
          geometry: { coordinates: [100.5341, 13.7455] },
          properties: { name: 'Siam Paragon', osm_id: 1, osm_type: 'W', osm_key: 'shop' },
        },
      ],
    }),
  } as unknown as Response)
  vi.stubGlobal('fetch', spy)
  vi.stubGlobal('navigator', { onLine: true })
  return spy
}

const urlOf = (spy: ReturnType<typeof stubFetch>) => new URL(spy.mock.calls[0][0] as string)

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('photonGeocodingService ส่งภาษาที่ผู้ใช้เลือก', () => {
  /*
   * เส้นทางนี้คือเส้นทางที่ใช้บ่อยที่สุดเวลาพิมพ์ตัวย่อหรือสะกดไม่ครบ
   * เดิมไม่เคยส่งภาษาไปเลย ผลลัพธ์จึงกลับมาเป็นชื่อไทยปนอยู่ในผลค้นหาภาษาอังกฤษ
   */
  it('ภาษาอังกฤษต้องส่ง lang=en ไม่ใช่ปล่อยให้ได้ชื่อท้องถิ่น', async () => {
    const spy = stubFetch()
    await photonGeocodingService.search('siam paragon', { language: 'en' })
    expect(urlOf(spy).searchParams.get('lang')).toBe('en')
  })

  /** Photon ไม่รองรับภาษาไทย ต้องส่ง default ซึ่งให้ชื่อตามท้องถิ่น = ไทย ตามที่ต้องการ */
  it('ภาษาไทยส่ง default เพราะ Photon ไม่มีภาษาไทยให้เลือก', async () => {
    const spy = stubFetch()
    await photonGeocodingService.search('สยามพารากอน', { language: 'th' })
    expect(urlOf(spy).searchParams.get('lang')).toBe('default')
  })

  it('ไม่ระบุภาษามาถือว่าเป็นไทยตามค่าเริ่มต้นของบริการ', async () => {
    const spy = stubFetch()
    await photonGeocodingService.search('สยามพารากอน')
    expect(urlOf(spy).searchParams.get('lang')).toBe('default')
  })

  it('ยังส่งคำค้นและตำแหน่งอ้างอิงไปตามเดิม', async () => {
    const spy = stubFetch()
    await photonGeocodingService.search('siam', {
      language: 'en',
      near: { lat: 13.7455, lng: 100.5341 },
    })
    const params = urlOf(spy).searchParams
    expect(params.get('q')).toBe('siam')
    expect(params.get('lat')).toBe('13.74550')
    expect(params.get('lon')).toBe('100.53410')
  })
})
