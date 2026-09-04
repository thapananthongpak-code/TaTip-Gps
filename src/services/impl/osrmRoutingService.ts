import {
  OSRM_BASE_URL,
  OSRM_FALLBACK_BASE_URL,
  OSRM_WALKING_PROFILE,
  WALKING_SPEED_MPS,
} from '@/services/config'
import type { RouteOptions, RoutingService } from '@/services/interfaces'
import { ServiceError } from '@/types'
import type { HazardKind, LatLng, ManeuverType, Place, Route, RouteStep } from '@/types'
import { fetchJson } from './httpClient'

/** รูปแบบข้อมูลดิบของ OSRM — ไม่รั่วออกไปนอก service นี้ */
interface OsrmManeuver {
  type: string
  modifier?: string
  location: [number, number]
}

interface OsrmIntersection {
  location: [number, number]
  /** ทางเข้า/ออกของแยกนี้ — จำนวนแขนมากกว่า 2 แปลว่าเป็นสี่แยก/สามแยก */
  entry: boolean[]
  bearings: number[]
}

interface OsrmStep {
  distance: number
  duration: number
  name: string
  maneuver: OsrmManeuver
  geometry: { coordinates: [number, number][] }
  intersections?: OsrmIntersection[]
}

interface OsrmRoute {
  distance: number
  duration: number
  geometry: { coordinates: [number, number][] }
  legs: { steps: OsrmStep[] }[]
}

interface OsrmResponse {
  code: string
  message?: string
  routes: OsrmRoute[]
}

/** GeoJSON เก็บพิกัดเป็น [lng, lat] สลับกับที่แอปใช้ */
const toLatLng = ([lng, lat]: [number, number]): LatLng => ({ lat, lng })

/**
 * แปลง maneuver ของ OSRM เป็นชนิดกลางของแอป
 * OSRM แยกเป็น type + modifier ส่วนแอปใช้ค่าเดียวเพื่อให้ map ไป i18n key ได้ตรงๆ
 */
function toManeuverType(m: OsrmManeuver): ManeuverType {
  if (m.type === 'depart') return 'depart'
  if (m.type === 'arrive') return 'arrive'
  if (m.type === 'roundabout' || m.type === 'rotary' || m.type === 'roundabout turn') {
    return 'roundabout'
  }

  switch (m.modifier) {
    case 'left':
      return 'left'
    case 'right':
      return 'right'
    case 'slight left':
      return 'slight-left'
    case 'slight right':
      return 'slight-right'
    case 'sharp left':
      return 'sharp-left'
    case 'sharp right':
      return 'sharp-right'
    case 'uturn':
      return 'uturn'
    default:
      return 'straight'
  }
}

/** ชื่อที่บ่งว่าเป็นถนนใหญ่ ไม่ใช่ซอยหรือทางเดินเล็ก */
const MAJOR_ROAD_PATTERNS = [/^ถนน/, /\bRoad\b/i, /\bRd\.?\b/i, /\bAvenue\b/i, /\bHighway\b/i]

/**
 * ตัดสินว่าปลายขั้นตอนนี้เป็นจุดเสี่ยงชนิดใด
 *
 * เกณฑ์ที่ใช้และเหตุผล (ปรับจากการดูข้อมูลจริงของ OSRM ในกรุงเทพฯ):
 * - เดิมใช้ "แยกตั้งแต่ 3 แขน" ซึ่งกวาดเกือบทุกขั้นตอน (6 จาก 8) จนคำเตือนไร้ความหมาย
 * - จึงเหลือสองเกณฑ์ที่บอกความเสี่ยงจริง:
 *   1. สี่แยก (4 แขนขึ้นไป) — รถมาได้หลายทิศพร้อมกัน
 *   2. ถนนที่มีชื่อขึ้นต้นว่า "ถนน" หรือลงท้ายด้วย Road/Avenue — เป็นถนนใหญ่ รถเร็ว
 * - จุดเริ่ม (depart) และจุดหมาย (arrive) ไม่นับเป็นจุดเสี่ยง เพราะผู้ใช้ยืนอยู่กับที่
 *
 * ข้อจำกัด: OSRM ฟรีไม่ได้บอกว่ามีทางม้าลายหรือสัญญาณไฟจริงหรือไม่
 * คำเตือนนี้จึงเป็นการ "ให้ระวังไว้ก่อน" ไม่ใช่การยืนยันว่ามีทางข้าม
 */
function detectHazard(step: OsrmStep): HazardKind | undefined {
  if (step.maneuver.type === 'depart' || step.maneuver.type === 'arrive') return undefined

  const bearings = step.intersections?.[0]?.bearings.length ?? 0
  if (bearings >= 4) return 'crossroads'

  const name = step.name?.trim()
  if (name && MAJOR_ROAD_PATTERNS.some((re) => re.test(name))) return 'major-road'

  return undefined
}

export const osrmRoutingService: RoutingService = {
  async getWalkingRoute(
    origin: LatLng,
    destination: Place,
    options: RouteOptions = {},
  ): Promise<Route> {
    try {
      return await requestRoute(OSRM_BASE_URL, origin, destination, options, false)
    } catch (err) {
      // ผู้ใช้ยกเลิกเอง หรือไม่มีเส้นทางจริงๆ — ลองเซิร์ฟเวอร์สำรองไปก็ไม่ช่วย
      if (err instanceof ServiceError && !err.retryable && err.code !== 'PROVIDER_ERROR') throw err

      // ทางสำรองใช้ profile รถยนต์ ได้เส้นทางหยาบๆ ดีกว่าไม่ได้อะไรเลย
      // แต่ต้องติดธงไว้ให้ชั้นบนเตือนผู้ใช้ก่อนเริ่มเดิน
      return requestRoute(OSRM_FALLBACK_BASE_URL, origin, destination, options, true)
    }
  },
}

async function requestRoute(
  baseUrl: string,
  origin: LatLng,
  destination: Place,
  options: RouteOptions,
  isFallback: boolean,
): Promise<Route> {
  const coords = `${origin.lng},${origin.lat};${destination.location.lng},${destination.location.lat}`
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    annotations: 'false',
  })

  const url = `${baseUrl}/route/v1/${OSRM_WALKING_PROFILE}/${coords}?${params}`
  const data = await fetchJson<OsrmResponse>(url, {
    signal: options.signal,
    onRetry: (attempt) => options.onRetry?.(attempt),
  })

  if (data.code !== 'Ok' || data.routes.length === 0) {
    // NoRoute = หาเส้นทางไม่ได้จริงๆ ลองใหม่ก็ไม่ช่วย
    throw new ServiceError(
      data.code === 'NoRoute' ? 'NOT_FOUND' : 'PROVIDER_ERROR',
      data.message ?? data.code,
      { retryable: false },
    )
  }

  const route = data.routes[0]
  const rawSteps = route.legs.flatMap((leg) => leg.steps)

  const steps: RouteStep[] = rawSteps.map((step, index) => ({
    id: `${index}`,
    maneuver: toManeuverType(step.maneuver),
    location: toLatLng(step.maneuver.location),
    distance: step.distance,
    duration: isFallback ? step.distance / WALKING_SPEED_MPS : step.duration,
    streetName: step.name || undefined,
    geometry: step.geometry.coordinates.map(toLatLng),
    hazard: detectHazard(step),
  }))

  return {
    id: `${Date.now()}`,
    distance: route.distance,
    // เวลาจากทางสำรองเป็นเวลาขับรถ ต้องคำนวณใหม่ด้วยความเร็วเดิน ไม่งั้นบอกผู้ใช้ผิดหลายเท่า
    duration: isFallback ? route.distance / WALKING_SPEED_MPS : route.duration,
    geometry: route.geometry.coordinates.map(toLatLng),
    steps,
    origin,
    destination,
    usedFallbackProfile: isFallback,
  }
}
