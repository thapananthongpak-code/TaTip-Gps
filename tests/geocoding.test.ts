import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ nominatim: vi.fn(), photon: vi.fn(), reverse: vi.fn() }))
vi.mock('../src/services/impl/nominatimGeocodingService', () => ({
  nominatimGeocodingService: { search: mocks.nominatim, reverse: mocks.reverse },
}))
vi.mock('../src/services/impl/photonGeocodingService', () => ({
  photonGeocodingService: { search: mocks.photon },
}))

const { compositeGeocodingService } = await import('../src/services/impl/compositeGeocodingService')

const place = (name: string) => ({
  id: name,
  name,
  address: '',
  location: { lat: 13.7, lng: 100.5 },
})

beforeEach(() => vi.clearAllMocks())

describe('compositeGeocodingService', () => {
  it('ใช้ผลของ Nominatim เมื่อเจอ และไม่ยิงตัวสำรองโดยไม่จำเป็น', async () => {
    mocks.nominatim.mockResolvedValue([place('สยามพารากอน')])

    const results = await compositeGeocodingService.search('สยามพารากอน')

    expect(results.map((r) => r.name)).toEqual(['สยามพารากอน'])
    expect(mocks.photon).not.toHaveBeenCalled()
  })

  it('ถอยไปใช้ Photon เมื่อ Nominatim ไม่เจออะไรเลย', async () => {
    // กรณีจริง: พิมพ์ไม่ครบคำ ซึ่ง Nominatim จับไม่ได้แต่ Photon จับได้
    mocks.nominatim.mockResolvedValue([])
    mocks.photon.mockResolvedValue([place('เซ็นทรัลเวิลด์')])

    const results = await compositeGeocodingService.search('เซ็นทรัลเวิล')

    expect(results.map((r) => r.name)).toEqual(['เซ็นทรัลเวิลด์'])
  })

  it('ตัวสำรองล่มไม่ทำให้การค้นหาทั้งหมดพัง', async () => {
    mocks.nominatim.mockResolvedValue([])
    mocks.photon.mockRejectedValue(new Error('down'))

    // ผู้ใช้ควรเห็นว่า "ไม่พบ" ซึ่งเป็นผลของตัวหลัก ไม่ใช่ "บริการขัดข้อง"
    await expect(compositeGeocodingService.search('อะไรสักอย่าง')).resolves.toEqual([])
  })

  it('ตัวหลักล่มยังคงเป็นข้อผิดพลาด ไม่กลบด้วยผลว่าง', async () => {
    mocks.nominatim.mockRejectedValue(new Error('down'))

    await expect(compositeGeocodingService.search('สยาม')).rejects.toThrow()
    expect(mocks.photon).not.toHaveBeenCalled()
  })

  it('ถอดรหัสพิกัดย้อนกลับใช้ Nominatim ตัวเดียว เพราะให้ที่อยู่เต็มกว่า', async () => {
    mocks.reverse.mockResolvedValue(place('ที่อยู่ทดสอบ'))

    const result = await compositeGeocodingService.reverse({ lat: 13.7, lng: 100.5 })

    expect(result?.name).toBe('ที่อยู่ทดสอบ')
    expect(mocks.photon).not.toHaveBeenCalled()
  })
})
