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

  /** เพิ่งเลี้ยวผ่านมา — ยังอยู่ใกล้จุดเลี้ยวและเริ่มเห็นว่าอยู่บนทางออกแล้ว */
  const justTurned =
    turnDistance >= STEP_ADVANCE_M &&
    turnDistance < 35 &&
    outgoing < 7 &&
    incoming > 7 &&
    outgoing + 5 < incoming

  /*
   * เลี้ยวผ่านมานานแล้ว — อยู่บนทางออกชัดเจนและห่างจากทางเข้ามาก
   *
   * จำเป็นเพราะ GPS ในเมืองอาจอัปเดตห่างกันหลายสิบเมตร ทำให้กระโดดข้ามช่วง
   * ที่ใช้ตัดสินว่า "เพิ่งเลี้ยว" ไปทั้งช่วง แล้วหลังจากนั้นระยะถึงจุดเลี้ยว
   * มีแต่จะไกลขึ้นเรื่อยๆ จนไม่มีวันกลับเข้าเงื่อนไขได้อีก
   *
   * ทดสอบแล้วพบว่าถ้า GPS อัปเดตทุก 40 เมตร ระบบจะค้างอยู่ขั้นตอนเดิมถาวร
   * พูดว่า "เลี้ยวขวา" ทั้งที่ผู้ใช้เลี้ยวไปแล้วและกำลังเดินอยู่บนถนนถัดไป
   *
   * ยังยึดหลักเดิมคือต้องมีหลักฐานบนทางออก ไม่ใช่แค่ GPS เข้าใกล้จุดเลี้ยว
   * แต่ใช้เกณฑ์ที่เข้มกว่าเพื่อชดเชยการที่ไม่จำกัดระยะ
   */
  const wellPastTurn = outgoing < 10 && incoming > 30 && outgoing + 20 < incoming

  if (stepIndex + 1 < lastIndex && (justTurned || wellPastTurn)) stepIndex += 1

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
  /*
   * ถึงปลายเส้นทางได้ ก็ต่อเมื่อระบบติดตามอยู่บนช่วงสุดท้ายมาก่อนแล้ว
   *
   * เงื่อนไข fromStepIndex สำคัญ: ห้ามประกาศว่าถึงจุดหมายจากการกระโดดมาถึง
   * ในอัปเดตเดียว เพราะพิกัดที่ตรงกับปลายทางไม่ได้แปลว่าเดินมาถึงจริง
   * อาจอยู่คนละฝั่งกำแพงหรือคนละชั้นของอาคารก็ได้
   *
   * ระหว่างเดินจริง อัปเดตก่อนหน้าจะพาเข้าช่วงสุดท้ายอยู่แล้ว
   * เงื่อนไขนี้จึงหน่วงแค่หนึ่งอัปเดต ไม่ได้ทำให้ประกาศช้าอย่างมีนัยสำคัญ
   */
  const trackedFinalLeg = Math.min(Math.max(fromStepIndex, 0), lastIndex - 1) >= lastIndex - 1
  const atRouteEnd = trackedFinalLeg && stepIndex >= lastIndex - 1 && distanceToNextManeuver < 12

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
