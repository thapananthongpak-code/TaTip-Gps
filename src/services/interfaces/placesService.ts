import type { LatLng, Place, PlaceCategory, ServiceLanguage } from '@/types'

export interface NearbyOptions {
  /** รัศมีค้นหา (เมตร) */
  radiusM?: number
  language?: ServiceLanguage
  limit?: number
  signal?: AbortSignal
}

/**
 * ค้นหาสถานที่รอบตัวตามหมวดหมู่
 *
 * แยกจาก GeocodingService เพราะเป็นคนละงานกัน:
 * - GeocodingService ตอบคำถาม "สถานที่ชื่อนี้อยู่ไหน" (ต้องรู้ชื่อก่อน)
 * - PlacesService ตอบคำถาม "รอบตัวฉันมีอะไรบ้าง" (ไม่ต้องรู้ชื่อ)
 *
 * คำถามแบบหลังสำคัญกว่ามากสำหรับคนตาบอด เพราะมองป้ายร้านไม่เห็น
 * จึงไม่มีทางรู้ชื่อร้านสะดวกซื้อหรือป้ายรถเมล์ที่อยู่ข้างหน้าเพื่อเอาไปค้นหา
 */
export interface PlacesService {
  findNearby(category: PlaceCategory, center: LatLng, options?: NearbyOptions): Promise<Place[]>
}
