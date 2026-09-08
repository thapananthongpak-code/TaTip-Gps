import { OSRM_BASE_URL, OSRM_WALKING_PROFILE } from '@/services/config'
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

function validCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    Math.abs(value[0]) <= 180 &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1]) &&
    Math.abs(value[1]) <= 90
  )
}
function validGeometry(value: unknown): value is [number, number][] {
  return Array.isArray(value) && value.length > 0 && value.every(validCoordinate)
}

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

  const bearings = step.intersections?.[0]?.bearings?.length ?? 0
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
    return requestRoute(OSRM_BASE_URL, origin, destination, options)
  },
}

async function requestRoute(
  baseUrl: string,
  origin: LatLng,
  destination: Place,
  options: RouteOptions,
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

  if (!data || data.code !== 'Ok' || !Array.isArray(data.routes) || data.routes.length === 0) {
    // NoRoute = หาเส้นทางไม่ได้จริงๆ ลองใหม่ก็ไม่ช่วย
    throw new ServiceError(
      data?.code === 'NoRoute' ? 'NOT_FOUND' : 'PROVIDER_ERROR',
      data?.message ?? data?.code,
      { retryable: false },
    )
  }

  const route = data.routes[0]
  if (
    !validGeometry(route?.geometry?.coordinates) ||
    !Array.isArray(route.legs) ||
    route.legs.some((leg) => !Array.isArray(leg?.steps)) ||
    !Number.isFinite(route.distance) ||
    route.distance < 0 ||
    !Number.isFinite(route.duration) ||
    route.duration < 0
  )
    throw new ServiceError('PROVIDER_ERROR')
  const rawSteps = route.legs.flatMap((leg) => leg.steps)
  if (
    rawSteps.length < 2 ||
    rawSteps[0]?.maneuver?.type !== 'depart' ||
    rawSteps.at(-1)?.maneuver?.type !== 'arrive' ||
    rawSteps.some(
      (step) =>
        !validCoordinate(step?.maneuver?.location) ||
        !validGeometry(step.geometry?.coordinates) ||
        typeof step.name !== 'string' ||
        !Number.isFinite(step.duration) ||
        step.duration < 0 ||
        !Number.isFinite(step.distance) ||
        step.distance < 0,
    )
  )
    throw new ServiceError('PROVIDER_ERROR')

  const steps: RouteStep[] = rawSteps.map((step, index) => ({
    id: `${index}`,
    maneuver: toManeuverType(step.maneuver),
    location: toLatLng(step.maneuver.location),
    distance: step.distance,
    duration: step.duration,
    streetName: step.name || undefined,
    geometry: step.geometry.coordinates.map(toLatLng),
    hazard: detectHazard(step),
  }))

  return {
    id: crypto.randomUUID(),
    distance: route.distance,
    duration: route.duration,
    geometry: route.geometry.coordinates.map(toLatLng),
    steps,
    origin,
    destination,
    usedFallbackProfile: false,
  }
}
