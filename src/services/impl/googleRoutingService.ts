import { API_BASE_URL } from '@/services/config'
import type { RouteOptions, RoutingService } from '@/services/interfaces'
import { ServiceError } from '@/types'
import type { HazardKind, LatLng, ManeuverType, Place, Route, RouteStep } from '@/types'
import { decodePolyline } from '@/utils/polyline'
import { fetchJson } from './httpClient'

interface ProxyStep {
  distanceMeters: number
  durationSeconds: number
  polyline: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  maneuver: string
  instruction: string
}

interface ProxyRoute {
  distanceMeters: number
  durationSeconds: number
  polyline: string
  steps: ProxyStep[]
}

/** แปลง maneuver ของ Routes API เป็นชนิดกลางของแอป */
function toManeuverType(maneuver: string): ManeuverType {
  switch (maneuver) {
    case 'DEPART':
      return 'depart'
    case 'DESTINATION':
    case 'DESTINATION_LEFT':
    case 'DESTINATION_RIGHT':
      return 'arrive'
    case 'TURN_LEFT':
    case 'RAMP_LEFT':
      return 'left'
    case 'TURN_RIGHT':
    case 'RAMP_RIGHT':
      return 'right'
    case 'TURN_SLIGHT_LEFT':
    case 'FORK_LEFT':
      return 'slight-left'
    case 'TURN_SLIGHT_RIGHT':
    case 'FORK_RIGHT':
      return 'slight-right'
    case 'TURN_SHARP_LEFT':
      return 'sharp-left'
    case 'TURN_SHARP_RIGHT':
      return 'sharp-right'
    case 'UTURN_LEFT':
    case 'UTURN_RIGHT':
      return 'uturn'
    case 'ROUNDABOUT_LEFT':
    case 'ROUNDABOUT_RIGHT':
      return 'roundabout'
    default:
      // NAME_CHANGE, STRAIGHT, MERGE และค่าที่ Google เพิ่มมาใหม่ในอนาคต
      return 'straight'
  }
}

/**
 * ดึงชื่อถนนออกจากข้อความคำสั่งของ Google
 *
 * Routes API ไม่มีฟิลด์ชื่อถนนแยกให้เหมือน OSRM มีแต่ประโยคเต็มที่แปลแล้ว
 * เช่น "Turn left onto Rama I Rd" หรือ "เลี้ยวซ้ายเข้าสู่ถนนพระรามที่ 1"
 *
 * จึงตัดเอาเฉพาะส่วนหลังคำเชื่อมที่ Google ใช้จริงในสองภาษาที่แอปรองรับ
 * ถ้าไม่พบคำเชื่อม คืน undefined แล้วปล่อยให้แอปพูดประโยคที่ไม่มีชื่อถนนแทน
 * ตั้งใจให้เข้มไว้ก่อน เพราะพูดชื่อถนนผิดแย่กว่าไม่พูดชื่อถนนเลย
 */
export function extractStreetName(instruction: string): string | undefined {
  if (!instruction) return undefined
  const match = instruction.match(/(?:\sonto\s|เข้าสู่|ไปยัง)(.+)$/)
  const name = match?.[1]?.trim().replace(/[.,]$/, '')
  if (!name || name.length < 2 || name.length > 60) return undefined
  return name
}

/** ชื่อที่บ่งว่าเป็นถนนใหญ่ ไม่ใช่ซอยหรือทางเดินเล็ก */
const MAJOR_ROAD_PATTERNS = [/ถนน/, /\bRoad\b/i, /\bRd\.?\b/i, /\bAvenue\b/i, /\bHighway\b/i]

/**
 * ตัดสินจุดเสี่ยงจากข้อความคำสั่ง
 *
 * ⚠️ ด้อยกว่าตอนใช้ OSRM อย่างมีนัยสำคัญ และต้องรู้ไว้:
 * OSRM บอกจำนวนแขนของแยกมาด้วย จึงตรวจ "สี่แยก" ได้ตรงๆ
 * ส่วน Routes API ไม่ส่งข้อมูลนั้นมาเลย เหลือแค่ดูว่าชื่อถนนเป็นถนนใหญ่หรือไม่
 * แปลว่าเมื่อใช้ Google แอปจะเตือนสี่แยกไม่ได้ ทั้งที่เป็นจุดอันตรายที่สุดจุดหนึ่ง
 *
 * ใช้ข้อความเต็มในการตรวจ ไม่ใช่ชื่อที่ตัดมาแล้ว เพื่อให้ยังตรวจได้
 * แม้จะดึงชื่อถนนออกมาไม่สำเร็จ การเตือนเกินฝั่งปลอดภัยกว่าการเงียบ
 */
function detectHazard(step: ProxyStep, maneuver: ManeuverType): HazardKind | undefined {
  if (maneuver === 'depart' || maneuver === 'arrive') return undefined
  return MAJOR_ROAD_PATTERNS.some((re) => re.test(step.instruction)) ? 'major-road' : undefined
}

const validCoordinate = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

/**
 * RoutingService บน Google Routes API ผ่าน proxy ของเราเอง
 *
 * ⚠️ travelMode เป็น WALK เสมอ ฝั่งเซิร์ฟเวอร์ไม่มีทางเลือกอื่นให้ส่ง
 * ห้ามถอยไปใช้เส้นทางรถเมื่อหาเส้นทางเดินไม่ได้ เพราะจะพาไปเดินบนถนนที่รถวิ่ง
 */
export const googleRoutingService: RoutingService = {
  async getWalkingRoute(
    origin: LatLng,
    destination: Place,
    options: RouteOptions = {},
  ): Promise<Route> {
    const { language = 'th', signal, onRetry } = options

    const params = new URLSearchParams({
      fromLat: String(origin.lat),
      fromLng: String(origin.lng),
      toLat: String(destination.location.lat),
      toLng: String(destination.location.lng),
      lang: language,
    })

    const data = await fetchJson<{ route?: ProxyRoute | null }>(
      `${API_BASE_URL}/api/route?${params}`,
      { signal, onRetry: onRetry ? (attempt) => onRetry(attempt) : undefined },
    )

    const route = data.route
    if (!route) throw new ServiceError('NOT_FOUND')
    if (
      !Number.isFinite(route.distanceMeters) ||
      route.distanceMeters < 0 ||
      !Number.isFinite(route.durationSeconds) ||
      route.durationSeconds < 0 ||
      !Array.isArray(route.steps) ||
      route.steps.length === 0
    )
      throw new ServiceError('PROVIDER_ERROR')

    const geometry = decodePolyline(route.polyline)
    if (geometry.length < 2) throw new ServiceError('PROVIDER_ERROR')

    const steps: RouteStep[] = []
    route.steps.forEach((step, index) => {
      if (!validCoordinate(step.startLat, step.startLng)) throw new ServiceError('PROVIDER_ERROR')
      if (!Number.isFinite(step.distanceMeters) || step.distanceMeters < 0)
        throw new ServiceError('PROVIDER_ERROR')

      /*
       * ขั้นตอนแรกต้องเป็น depart เสมอ
       * Routes API ไม่ได้ใส่ maneuver มาให้ทุกขั้นตอน ขั้นแรกมักว่างเปล่า
       * แต่ส่วนคำนวณความคืบหน้าของแอปยึดโครงเดียวกับ OSRM คือเริ่ม depart จบ arrive
       */
      const maneuver = index === 0 ? 'depart' : toManeuverType(step.maneuver)
      const line = decodePolyline(step.polyline)

      steps.push({
        id: `${index}`,
        maneuver,
        location: { lat: step.startLat, lng: step.startLng },
        distance: step.distanceMeters,
        duration: step.durationSeconds,
        streetName: extractStreetName(step.instruction),
        geometry: line.length >= 2 ? line : [{ lat: step.startLat, lng: step.startLng }],
        hazard: detectHazard(step, maneuver),
      })
    })

    /*
     * ปิดท้ายด้วยขั้นตอน arrive ที่จุดสิ้นสุดของขั้นตอนสุดท้าย
     *
     * ต้องมี เพราะ computeProgress ถือว่า steps สุดท้ายคือจุดหมาย และใช้ระยะถึงจุดนั้น
     * ตัดสินว่าถึงแล้วหรือยัง ถ้าไม่เติม ขั้นตอนสุดท้ายของ Google จะกลายเป็นจุดเลี้ยว
     * ที่ไม่มีวันผ่าน แล้วผู้ใช้จะไม่ได้ยินคำว่าถึงจุดหมายเลย
     */
    const last = route.steps[route.steps.length - 1]
    if (!validCoordinate(last.endLat, last.endLng)) throw new ServiceError('PROVIDER_ERROR')
    steps.push({
      id: `${route.steps.length}`,
      maneuver: 'arrive',
      location: { lat: last.endLat, lng: last.endLng },
      distance: 0,
      duration: 0,
      geometry: [{ lat: last.endLat, lng: last.endLng }],
    })

    if (steps.length < 2) throw new ServiceError('PROVIDER_ERROR')

    return {
      id: crypto.randomUUID(),
      distance: route.distanceMeters,
      duration: route.durationSeconds,
      geometry,
      steps,
      origin,
      destination,
      usedFallbackProfile: false,
    }
  },
}
