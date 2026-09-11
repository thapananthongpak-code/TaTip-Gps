import { OVERPASS_MIRRORS, OVERPASS_MIN_INTERVAL_MS, OVERPASS_TIMEOUT_MS } from '@/services/config'
import { ServiceError } from '@/types'
import type { LatLng } from '@/types'
import { createTtlCache } from '@/utils/cache'
import { fetchJson } from './httpClient'
import { createRateLimiter } from './requestQueue'

/** รูปแบบข้อมูลดิบของ Overpass — ไม่รั่วออกไปนอกไฟล์ที่แปลงมันเป็นไทป์กลาง */
export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  /** way/relation ไม่มีพิกัดของตัวเอง ต้องขอ `out center` เพื่อให้ได้จุดกึ่งกลาง */
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements?: OverpassElement[]
}

const schedule = createRateLimiter(OVERPASS_MIN_INTERVAL_MS)

/**
 * Overpass ช้า (1-5 วินาที) และเป็นทรัพยากรบริจาค
 * cache จึงตั้งอายุยาวกว่าของ Nominatim มาก เพราะข้อมูลพวกนี้แทบไม่เปลี่ยนรายวัน
 * (บันไดกับเสากั้นไม่ได้ย้ายที่ทุกชั่วโมง)
 */
const responseCache = createTtlCache<OverpassElement[]>(30 * 60 * 1000, 40)

/**
 * จำว่า mirror ตัวไหนใช้ได้ล่าสุด
 *
 * ไม่เริ่มจากตัวแรกทุกครั้ง เพราะถ้าตัวแรกล่มอยู่ ผู้ใช้จะต้องรอ timeout
 * ของตัวที่ล่มก่อนทุกคำขอ ซึ่งระหว่างเดินอยู่นั่นคือความล่าช้าที่รับไม่ได้
 */
let preferredMirror = 0

/** ดึงพิกัดของ element ไม่ว่าจะเป็น node หรือ way */
export function elementLocation(element: OverpassElement): LatLng | null {
  const lat = element.lat ?? element.center?.lat
  const lon = element.lon ?? element.center?.lon
  if (typeof lat !== 'number' || typeof lon !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lng: lon }
}

/**
 * ยิง Overpass QL แล้วคืน element ที่ผ่านการตรวจรูปร่างแล้ว
 *
 * วนลอง mirror ทีละตัวจนกว่าจะมีตัวตอบสำเร็จ แล้วจำตัวนั้นไว้ใช้ครั้งต่อไป
 * ถ้าล่มหมดทุกตัวจะโยน error ของตัวสุดท้าย ให้ชั้นบนตัดสินใจว่าจะบอกผู้ใช้อย่างไร
 *
 * ใช้ GET เพื่อให้ผ่าน fetchJson ตัวเดิมได้ทั้งดุ้น — ได้ retry แบบ backoff,
 * การเคารพ Retry-After และ cooldown ระดับผู้ให้บริการมาฟรีทั้งหมด
 */
export async function overpassQuery(
  query: string,
  options: { signal?: AbortSignal; cacheKey?: string } = {},
): Promise<OverpassElement[]> {
  const cacheKey = options.cacheKey ?? query
  const cached = responseCache.get(cacheKey)
  if (cached) return cached

  const encoded = encodeURIComponent(query)
  let lastError: unknown = new ServiceError('PROVIDER_ERROR', 'No Overpass mirror configured')

  for (let attempt = 0; attempt < OVERPASS_MIRRORS.length; attempt++) {
    const index = (preferredMirror + attempt) % OVERPASS_MIRRORS.length
    try {
      const data = await fetchJson<OverpassResponse>(`${OVERPASS_MIRRORS[index]}?data=${encoded}`, {
        signal: options.signal,
        schedule,
        timeoutMs: OVERPASS_TIMEOUT_MS,
        // Overpass จัดคิวงานฝั่งเซิร์ฟเวอร์อยู่แล้ว ยิงซ้ำถี่ๆ มีแต่ทำให้คิวยาวขึ้น
        // ถ้าตัวนี้ไม่ไหว ย้ายไป mirror ตัวถัดไปคุ้มกว่าการรอตัวเดิม
        retries: 0,
      })

      if (!data || typeof data !== 'object' || !Array.isArray(data.elements)) {
        throw new ServiceError('PROVIDER_ERROR', 'Overpass response malformed')
      }

      preferredMirror = index
      responseCache.set(cacheKey, data.elements)
      return data.elements
    } catch (error) {
      // ผู้ใช้ยกเลิกเอง ไม่ใช่ mirror มีปัญหา จึงไม่ต้องไปลองตัวอื่น
      if (error instanceof ServiceError && error.code === 'ABORTED') throw error
      lastError = error
    }
  }

  throw lastError
}

/** แปลงพิกัดเป็นรูปแบบที่ตัวกรอง around ของ Overpass ต้องการ: "lat,lon,lat,lon,..." */
export function toAroundList(points: LatLng[]): string {
  return points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(',')
}

/**
 * ลดจำนวนจุดของเส้นทางก่อนส่งให้ Overpass
 *
 * เส้นทางจริงมีได้เป็นร้อยจุด ถ้าใส่ทั้งหมดลงตัวกรอง around
 * URL จะยาวเกินและเซิร์ฟเวอร์ต้องทำงานหนักโดยไม่จำเป็น
 * เก็บจุดที่ห่างกันเกิน minSpacing ก็ครอบคลุมทางเดินได้ครบแล้ว
 * เพราะรัศมีที่ค้นรอบแต่ละจุดกว้างกว่าระยะห่างระหว่างจุด
 */
export function simplifyPath(points: LatLng[], minSpacingM: number, maxPoints: number): LatLng[] {
  if (points.length === 0) return []

  const kept: LatLng[] = [points[0]]
  // ประมาณระยะเป็นองศา พอสำหรับการคัดจุด ไม่ต้องแม่นระดับเมตร
  const minDeg = minSpacingM / 111_320

  for (const point of points.slice(1)) {
    const last = kept[kept.length - 1]
    const dLat = point.lat - last.lat
    const dLng = (point.lng - last.lng) * Math.cos((point.lat * Math.PI) / 180)
    if (Math.hypot(dLat, dLng) >= minDeg) kept.push(point)
  }

  // จุดสุดท้ายสำคัญเสมอ (ปลายทาง) ต้องไม่ถูกตัดทิ้ง
  const last = points[points.length - 1]
  if (kept[kept.length - 1] !== last) kept.push(last)

  if (kept.length <= maxPoints) return kept

  // ยังมากเกินไปก็คัดให้เว้นระยะเท่าๆ กัน โดยคงจุดแรกและจุดสุดท้ายไว้
  const step = (kept.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, i) => kept[Math.round(i * step)])
}
