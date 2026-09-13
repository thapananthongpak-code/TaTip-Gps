import type { GeocodingService, SearchOptions } from '@/services/interfaces'
import type { LatLng, Place } from '@/types'
import { nominatimGeocodingService } from './nominatimGeocodingService'
import { photonGeocodingService } from './photonGeocodingService'

/**
 * ค้นหาด้วย Nominatim ก่อน แล้วถอยไป Photon เมื่อไม่พบอะไรเลย
 *
 * ทั้งสองตัวใช้ข้อมูล OSM ชุดเดียวกัน แต่ทำ index คนละแบบจึงเก่งคนละอย่าง
 * วัดจริงด้วยคำที่คนพิมพ์:
 *
 * | คำค้น                        | Nominatim | Photon |
 * | ---------------------------- | --------- | ------ |
 * | "สยามพารากอน"                | พบ        | ไม่พบ  |
 * | "เซ็นทรัลเวิล" (พิมพ์ไม่ครบ) | ไม่พบ     | พบ     |
 * | "หมอชิต2" (ไม่เว้นวรรค)      | ไม่พบ     | พบ     |
 *
 * เรียง Nominatim ก่อนเพราะจัดอันดับได้ตรงกว่าและให้ที่อยู่เต็ม
 * เมื่อคำค้นถูกต้องอยู่แล้ว ซึ่งเป็นกรณีส่วนใหญ่
 * Photon จึงถูกเรียกเฉพาะตอนที่ผลว่างจริง ไม่เพิ่มภาระในกรณีปกติ
 */
export const compositeGeocodingService: GeocodingService = {
  async search(query: string, options: SearchOptions = {}): Promise<Place[]> {
    const primary = await nominatimGeocodingService.search(query, options)
    if (primary.length > 0) return primary

    try {
      return await photonGeocodingService.search(query, options)
    } catch {
      // ตัวสำรองล่มไม่ควรกลายเป็นข้อผิดพลาดของทั้งการค้นหา
      // ผู้ใช้ควรเห็นว่า "ไม่พบ" ซึ่งเป็นผลของตัวหลักที่ทำงานสำเร็จแล้ว
      // ไม่ใช่ "บริการขัดข้อง" ซึ่งจะทำให้เข้าใจผิดว่าต้องลองใหม่
      return []
    }
  },

  /** ที่อยู่เต็มสำหรับปุ่ม "ฉันอยู่ที่ไหน" Nominatim ให้ได้ดีกว่า จึงใช้ตัวเดียว */
  reverse(location: LatLng, options?: SearchOptions): Promise<Place | null> {
    return nominatimGeocodingService.reverse(location, options)
  },
}
