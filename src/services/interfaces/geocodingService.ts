import type { LatLng, Place, ServiceLanguage } from '@/types'

export interface SearchOptions {
  /** ภาษาที่อยากได้ผลลัพธ์ (ส่งไปเป็น accept-language) */
  language?: ServiceLanguage
  /** จำกัดจำนวนผลลัพธ์ */
  limit?: number
  /** ตำแหน่งผู้ใช้ เพื่อจัดอันดับผลลัพธ์ใกล้ตัวก่อน */
  near?: LatLng
  /** ยกเลิกคำขอเมื่อผู้ใช้พิมพ์ต่อ */
  signal?: AbortSignal
}

/**
 * ค้นหาสถานที่และถอดรหัสพิกัดย้อนกลับ
 * implementation ปัจจุบัน: Nominatim (ดู services/impl/nominatimGeocodingService.ts)
 * ถ้าจะย้ายไป Google Places ในอนาคต แก้แค่ implementation ที่ implement interface นี้
 */
export interface GeocodingService {
  /** ค้นหาสถานที่จากข้อความ (รองรับไทย/อังกฤษ) */
  search(query: string, options?: SearchOptions): Promise<Place[]>
  /** แปลงพิกัดเป็นที่อยู่ สำหรับปุ่ม "ตำแหน่งฉันอยู่ไหน" */
  reverse(location: LatLng, options?: SearchOptions): Promise<Place | null>
}
