import { WALKING_SPEED_MPS, mapService } from '@/services'
import type { LatLng, Route, RouteStep } from '@/types'
import { distanceToPath, remainingPathDistance } from './geometry'

/** ถึงจุดหมายเมื่อเข้าใกล้กว่านี้ (เมตร) */
export const ARRIVAL_RADIUS_M = 25
/** Minimum displacement beyond a turn before evaluating outgoing-path evidence. */
export const STEP_ADVANCE_M = 8
/** ห่างจากเส้นทางเกินนี้ = ออกนอกเส้นทาง (เมตร) */
export const OFF_ROUTE_M = 40

export interface RouteProgress {
  /** ขั้นตอนที่ผู้ใช้กำลังเดินอยู่ */
  stepIndex: number
  /** จุดเลี้ยวถัดไปที่ต้องเตือน */
  nextStep: RouteStep
  distanceToNextManeuver: number
  remainingDistance: number
  remainingDuration: number
  /** ระยะห่างจากเส้นทาง — ใช้ตัดสินว่าออกนอกเส้นทางหรือยัง */
  deviation: number
  hasArrived: boolean
  /**
   * ระยะจากผู้ใช้ถึงพิกัดของสถานที่ปลายทางจริงๆ
   *
   * มักไม่เท่ากับ 0 ตอนถึงปลายเส้นทาง เพราะบริการเส้นทางจะ snap จุดหมาย
   * เข้าหาถนน/ทางเดินที่ใกล้ที่สุด ขณะที่พิกัดจาก Nominatim เป็นจุดกึ่งกลางอาคาร
   * ต้องบอกส่วนต่างนี้ให้ผู้ใช้รู้ ไม่งั้นจะยืนงงว่าทำไมยังไม่เจอที่หมาย
   */
  distanceToDestination: number
}

/**
 * คำนวณความคืบหน้าบนเส้นทาง ณ ตำแหน่งหนึ่ง
 *
 * แยกออกมาเป็นฟังก์ชันบริสุทธิ์ (ไม่มี state ของ React) เพราะเป็นหัวใจของการนำทาง
 * ถ้าคำนวณผิด ผู้ใช้ที่มองไม่เห็นจะได้ยินคำสั่งเลี้ยวผิดจังหวะ ซึ่งอันตราย
 * รูปแบบนี้ทำให้จำลองการเดินทั้งเส้นทางแล้วตรวจผลได้โดยไม่ต้องออกไปเดินจริง
 *
 * ความหมายของ step ตามรูปแบบของ OSRM:
 *   steps[i].location = จุดที่ต้องทำ maneuver ที่ i
 *   steps[i].distance = ระยะจาก maneuver ที่ i ไปยัง maneuver ที่ i+1
 * ดังนั้นขณะอยู่ที่ stepIndex = i ผู้ใช้กำลังเดินเข้าหา maneuver ที่ i+1
 */
export function computeProgress(
  route: Route,
  position: LatLng,
  fromStepIndex: number,
): RouteProgress {
  const steps = route.steps
  const lastIndex = steps.length - 1
  if (lastIndex < 1) throw new Error('Route has no navigable steps')

  // Do not skip a turn just because GPS is approaching it. Require evidence on
  // the outgoing path; at most one turn per update. Closely spaced turns have
  // an explicit confirmation control when GPS cannot distinguish them.
  let stepIndex = Math.min(Math.max(fromStepIndex, 0), lastIndex - 1)
  const upcoming = steps[stepIndex + 1]
  const turnDistance = mapService.distanceBetween(position, upcoming.location)
  const incoming = distanceToPath(position, steps[stepIndex].geometry)
  const outgoing = distanceToPath(position, upcoming.geometry)
  if (
    stepIndex + 1 < lastIndex &&
    turnDistance >= STEP_ADVANCE_M &&
    turnDistance < 35 &&
    outgoing < 7 &&
    incoming > 7 &&
    outgoing + 5 < incoming
  )
    stepIndex += 1

  const nextStep = stepIndex < lastIndex ? steps[stepIndex + 1] : steps[lastIndex]
  const directDistance = mapService.distanceBetween(position, nextStep.location)
  const distanceToNextManeuver = Math.max(
    directDistance,
    remainingPathDistance(position, steps[stepIndex].geometry),
  )

  let remainingDistance = distanceToNextManeuver
  for (let i = stepIndex + 1; i <= lastIndex; i++) remainingDistance += steps[i].distance

  // ใช้ความเร็วจริงของเส้นทางถ้าคำนวณได้ ไม่งั้นใช้ความเร็วเดินเฉลี่ย
  const speed =
    route.duration > 0 && route.distance > 0 ? route.distance / route.duration : WALKING_SPEED_MPS

  const distanceToDestination = mapService.distanceBetween(position, route.destination.location)

  // Only the final route segment may produce arrival. Never use proximity to a
  // building centroid alone; report the remaining endpoint-to-building offset.
  const atRouteEnd = stepIndex >= lastIndex - 1 && distanceToNextManeuver < 12

  return {
    stepIndex,
    nextStep,
    distanceToNextManeuver,
    remainingDistance,
    remainingDuration: remainingDistance / speed,
    deviation: distanceToPath(position, route.geometry),
    hasArrived: atRouteEnd,
    distanceToDestination,
  }
}
