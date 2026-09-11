import type { LatLng } from './geo'

/**
 * หมวดหมู่สถานที่ที่ค้นหาแบบ "ใกล้ฉัน" ได้
 *
 * เลือกเฉพาะหมวดที่คนตาบอดต้องใช้จริงในชีวิตประจำวัน
 * ไม่ใส่หมวดที่ค้นแล้วเจอเป็นร้อยจนฟังไม่ไหว
 */
export type PlaceCategory =
  'transit' | 'convenience' | 'food' | 'pharmacy' | 'hospital' | 'bank' | 'toilets' | 'government'

/** ชนิดสิ่งกีดขวางบนทางเดิน */
export type ObstacleKind =
  /** บันได — อันตรายที่สุดสำหรับคนตาบอดถ้าไม่รู้ล่วงหน้า */
  | 'steps'
  /** ประตู/เสากั้น/แผงกั้น ที่ต้องเดินอ้อมหรือเปิดผ่าน */
  | 'barrier'
  /** ขอบทางเท้าสูง ต้องก้าวขึ้นลง */
  | 'kerb'
  /** เขตก่อสร้าง ทางเดินอาจถูกปิดหรือเปลี่ยนรูป */
  | 'construction'
  /** ทางข้ามที่ไม่มีเบรลล์บล็อก (พื้นผิวต่างสัมผัส) */
  | 'crossing_no_tactile'
  /** ทางแคบ เข็นรถหรือใช้ไม้เท้ากวาดลำบาก */
  | 'narrow'

/** ระดับความสำคัญ ใช้ตัดสินว่าต้องเตือนด้วยเสียงทันทีหรือแค่รายงานก่อนออกเดินทาง */
export type ObstacleSeverity = 'high' | 'medium'

export interface Obstacle {
  id: string
  kind: ObstacleKind
  severity: ObstacleSeverity
  location: LatLng
  /** ต้องเดินจากจุดเริ่มต้นของเส้นทางกี่เมตรถึงจะถึงจุดนี้ — ใช้เรียงลำดับและเตือนล่วงหน้า */
  distanceFromStartM: number
  /** รายละเอียดเพิ่มจากข้อมูล OSM เช่น จำนวนขั้นบันได หรือมีราวจับหรือไม่ */
  detail?: {
    stepCount?: number
    hasHandrail?: boolean
    /** ขึ้นหรือลง เมื่อเดินตามทิศของ way */
    incline?: 'up' | 'down'
    width?: number
    name?: string
  }
}

/** สรุปสิ่งกีดขวางทั้งเส้นทาง สำหรับอ่านให้ฟังก่อนเริ่มเดิน */
export interface ObstacleReport {
  obstacles: Obstacle[]
  /** จำนวนแยกตามชนิด ใช้สร้างประโยคสรุป */
  countsByKind: Partial<Record<ObstacleKind, number>>
  /** true = สแกนไม่สำเร็จ (บริการล่ม/เน็ตหลุด) ต่างจาก "สแกนแล้วไม่เจออะไร" */
  failed: boolean
}
