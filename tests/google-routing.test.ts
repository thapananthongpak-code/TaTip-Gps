import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractStreetName, googleRoutingService } from '../src/services/impl/googleRoutingService'
import type { Place } from '../src/types'

const destination: Place = {
  id: 'd',
  name: 'ปลายทาง',
  address: '',
  location: { lat: 13.7441, lng: 100.5452 },
}
const origin = { lat: 13.7455, lng: 100.5341 }

/** เข้ารหัส polyline แบบเดียวกับที่ Google ส่งมา เพื่อไม่ต้องฝังสตริงลึกลับไว้ในเทสต์ */
function encode(points: { lat: number; lng: number }[]): string {
  let previousLat = 0
  let previousLng = 0
  let out = ''
  const chunk = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
      v >>= 5
    }
    out += String.fromCharCode(v + 63)
  }
  for (const point of points) {
    const lat = Math.round(point.lat * 1e5)
    const lng = Math.round(point.lng * 1e5)
    chunk(lat - previousLat)
    chunk(lng - previousLng)
    previousLat = lat
    previousLng = lng
  }
  return out
}

const line = [origin, { lat: 13.745, lng: 100.54 }, destination.location]

function reply(route: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ route }),
  } as unknown as Response
}

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.unstubAllGlobals())

function stub(route: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(route)))
  vi.stubGlobal('navigator', { onLine: true })
}

const baseRoute = {
  distanceMeters: 1200,
  durationSeconds: 900,
  polyline: encode(line),
  steps: [
    {
      distanceMeters: 700,
      durationSeconds: 520,
      polyline: encode([origin, { lat: 13.745, lng: 100.54 }]),
      startLat: origin.lat,
      startLng: origin.lng,
      endLat: 13.745,
      endLng: 100.54,
      maneuver: '',
      instruction: 'Head east on ถนนพระรามที่ 1',
    },
    {
      distanceMeters: 500,
      durationSeconds: 380,
      polyline: encode([{ lat: 13.745, lng: 100.54 }, destination.location]),
      startLat: 13.745,
      startLng: 100.54,
      endLat: destination.location.lat,
      endLng: destination.location.lng,
      maneuver: 'TURN_LEFT',
      instruction: 'Turn left onto Witthayu Rd',
    },
  ],
}

describe('googleRoutingService', () => {
  it('แปลงเส้นทางของ Google เป็นโครงเดียวกับที่ส่วนนำทางใช้', async () => {
    stub(baseRoute)
    const route = await googleRoutingService.getWalkingRoute(origin, destination)

    expect(route.distance).toBe(1200)
    expect(route.duration).toBe(900)
    expect(route.geometry.length).toBe(3)
    expect(route.usedFallbackProfile).toBe(false)
  })

  /*
   * computeProgress ยึดโครงเดียวกับ OSRM คือเริ่มด้วย depart จบด้วย arrive
   * Routes API ไม่ส่ง maneuver ของขั้นแรกมา และไม่มีขั้นตอน arrive ให้เลย
   * ถ้าไม่เติมให้ครบ ผู้ใช้จะไม่ได้ยินคำว่าถึงจุดหมายตลอดไป
   */
  it('เริ่มด้วย depart และปิดท้ายด้วย arrive เสมอ', async () => {
    stub(baseRoute)
    const route = await googleRoutingService.getWalkingRoute(origin, destination)

    expect(route.steps[0].maneuver).toBe('depart')
    expect(route.steps.at(-1)!.maneuver).toBe('arrive')
    expect(route.steps.at(-1)!.distance).toBe(0)
    expect(route.steps.at(-1)!.location).toEqual(destination.location)
    expect(route.steps.length).toBe(3)
  })

  it('แปลงชนิดการเลี้ยวเป็นคำที่แอปพูดได้', async () => {
    stub(baseRoute)
    const route = await googleRoutingService.getWalkingRoute(origin, destination)
    expect(route.steps[1].maneuver).toBe('left')
  })

  it('เตือนถนนใหญ่จากข้อความคำสั่ง', async () => {
    stub(baseRoute)
    const route = await googleRoutingService.getWalkingRoute(origin, destination)
    expect(route.steps[1].hazard).toBe('major-road')
    // จุดเริ่มต้นไม่ใช่จุดเสี่ยง ผู้ใช้ยังยืนอยู่กับที่
    expect(route.steps[0].hazard).toBeUndefined()
  })

  /* เส้นทางที่ถอดไม่ได้ ต้องล้มให้ดังกว่าการคืนเส้นทางเพี้ยนให้คนตาบอดเดินตาม */
  it('ปฏิเสธเส้นทางที่ polyline เสีย', async () => {
    stub({ ...baseRoute, polyline: '!!!!' })
    await expect(googleRoutingService.getWalkingRoute(origin, destination)).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    })
  })

  it('ปฏิเสธเมื่อไม่มีเส้นทาง แทนที่จะคืนเส้นทางว่าง', async () => {
    stub(null)
    await expect(googleRoutingService.getWalkingRoute(origin, destination)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('ปฏิเสธระยะทางติดลบ', async () => {
    stub({ ...baseRoute, distanceMeters: -5 })
    await expect(googleRoutingService.getWalkingRoute(origin, destination)).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    })
  })
})

describe('extractStreetName', () => {
  it('ดึงชื่อถนนจากประโยคอังกฤษ', () => {
    expect(extractStreetName('Turn left onto Witthayu Rd')).toBe('Witthayu Rd')
  })

  it('ดึงชื่อถนนจากประโยคไทย', () => {
    expect(extractStreetName('เลี้ยวซ้ายเข้าสู่ถนนวิทยุ')).toBe('ถนนวิทยุ')
  })

  /*
   * ไม่มีคำเชื่อมแปลว่าเดาไม่ได้ ต้องคืน undefined
   * พูดชื่อถนนผิดให้คนที่มองไม่เห็นแย่กว่าไม่พูดชื่อถนนเลย
   */
  it('คืน undefined เมื่อไม่มีคำเชื่อมให้ยึด', () => {
    expect(extractStreetName('Head east')).toBeUndefined()
    expect(extractStreetName('เดินตรงไป')).toBeUndefined()
    expect(extractStreetName('')).toBeUndefined()
  })

  it('ไม่รับชื่อที่สั้นหรือยาวผิดปกติ', () => {
    expect(extractStreetName('Turn left onto A')).toBeUndefined()
    expect(extractStreetName(`Turn left onto ${'x'.repeat(80)}`)).toBeUndefined()
  })
})
