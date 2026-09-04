import type { LatLng, Place } from './geo'
import type { HazardKind } from './safety'

/** ชนิดการเลี้ยว/การเคลื่อนที่แบบกลาง — map มาจาก OSRM maneuver ได้ และรองรับผู้ให้บริการอื่นในอนาคต */
export type ManeuverType =
  | 'depart'
  | 'straight'
  | 'slight-left'
  | 'left'
  | 'sharp-left'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'uturn'
  | 'roundabout'
  | 'crossing'
  | 'arrive'

/** หนึ่งขั้นตอนของเส้นทาง (turn-by-turn) */
export interface RouteStep {
  id: string
  maneuver: ManeuverType
  /** พิกัดของจุดที่ต้องทำ maneuver นี้ */
  location: LatLng
  /** ระยะทางของขั้นตอนนี้ (เมตร) */
  distance: number
  /** เวลาโดยประมาณของขั้นตอนนี้ (วินาที) */
  duration: number
  /** ชื่อถนน (ถ้ามี) */
  streetName?: string
  /** เส้นทางย่อยของขั้นตอนนี้ สำหรับวาดบนแผนที่ */
  geometry: LatLng[]
  /**
   * ชนิดจุดเสี่ยงที่ปลายขั้นตอนนี้ (ถ้ามี) — ใช้เตือนล่วงหน้าด้วยเสียงและการสั่น
   * undefined = ไม่ถือว่าเสี่ยงเป็นพิเศษ
   */
  hazard?: HazardKind
}

export interface Route {
  id: string
  /** ระยะทางรวม (เมตร) */
  distance: number
  /** เวลาเดินโดยประมาณ (วินาที) */
  duration: number
  /** เส้นทางเต็มสำหรับวาดบนแผนที่ */
  geometry: LatLng[]
  steps: RouteStep[]
  origin: LatLng
  destination: Place
  /**
   * true = เส้นทางนี้มาจากบริการสำรองที่ใช้ profile รถยนต์ ไม่ใช่ทางเดินเท้าจริง
   * ต้องเตือนผู้ใช้ด้วยเสียงก่อนเริ่มเดิน
   */
  usedFallbackProfile?: boolean
}
