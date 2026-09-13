import type { PlaceCategory } from './places'

/** พิกัดภูมิศาสตร์แบบกลาง — ไม่ผูกกับ Leaflet หรือ Google Maps */
export interface LatLng {
  lat: number
  lng: number
}

/** ตำแหน่งที่ได้จาก Geolocation API พร้อมข้อมูลคุณภาพสัญญาณ */
export interface GeoPosition extends LatLng {
  /** ความคลาดเคลื่อนโดยประมาณ (เมตร) */
  accuracy: number
  /** ทิศที่กำลังหันไป (องศา, 0 = เหนือ) — null ถ้าอุปกรณ์ไม่รายงาน */
  heading: number | null
  /** ความเร็ว (เมตร/วินาที) — null ถ้าอุปกรณ์ไม่รายงาน */
  speed: number | null
  /** เวลาที่บันทึกตำแหน่ง (epoch ms) */
  timestamp: number
}

export type GeoErrorCode =
  'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED' | 'INSECURE_CONTEXT'

export interface GeoError {
  code: GeoErrorCode
  /** ข้อความดิบจากเบราว์เซอร์ (ใช้ debug เท่านั้น — ข้อความที่แสดง/พูดมาจาก i18n) */
  raw?: string
}

/** กรอบสี่เหลี่ยมครอบพื้นที่ (ใช้ตอน fit แผนที่ให้เห็นทั้งเส้นทาง) */
export interface BoundingBox {
  southWest: LatLng
  northEast: LatLng
}

/** สถานที่ที่ได้จากการค้นหา/ถอดรหัสพิกัดย้อนกลับ */
export interface Place {
  id: string
  /** ชื่อย่อสำหรับพูด เช่น "เซ็นทรัลเวิลด์" */
  name: string
  /** ที่อยู่เต็มสำหรับแสดง/พูด */
  address: string
  location: LatLng
  boundingBox?: BoundingBox
  /** ประเภทสถานที่จากผู้ให้บริการ เช่น "restaurant", "bus_stop" */
  category?: string
  /**
   * หมวดหมู่ของแอปเอง ใส่มาเมื่อสถานที่นี้มาจากการค้นแบบ "ใกล้ฉัน"
   * ใช้ตั้งชื่อแทนให้สถานที่ที่ไม่มีชื่อในแผนที่ (ตู้เอทีเอ็ม ห้องน้ำ ป้ายรถเมล์)
   */
  categoryKey?: PlaceCategory
  /**
   * true = ไม่ใช่ผลที่ตรงกับที่พิมพ์ แต่เป็นชื่อใกล้เคียงที่ระบบหามาให้
   *
   * ต้องบอกผู้ใช้ให้ชัด เพราะคนที่มองไม่เห็นเลือกจากเสียงอย่างเดียว
   * ถ้าพิมพ์ "สยามพารากอน" แล้วได้ "สยามราม่า" โดยไม่รู้ว่าเป็นแค่ชื่อคล้าย
   * เขาอาจกดเลือกแล้วเดินไปผิดที่โดยไม่รู้ตัว
   */
  isApproximate?: boolean
}
