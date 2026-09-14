import type { LatLng } from '@/types'

/**
 * ถอดรหัส encoded polyline ของ Google เป็นพิกัด
 *
 * Routes API ส่งเส้นทางมาเป็นสตริงที่บีบอัดแล้ว ไม่ใช่อาร์เรย์ของพิกัดแบบ OSRM
 * ต้องถอดเองเพราะทั้งการวาดเส้นบนแผนที่ การวัดว่าออกนอกเส้นทางหรือยัง
 * และการหาว่าสิ่งกีดขวางอยู่ตรงไหนของเส้นทาง ล้วนทำงานกับพิกัดจริงทั้งหมด
 *
 * อัลกอริทึม: ผลต่างจากจุดก่อนหน้า คูณ 1e5 แล้วเข้ารหัสฐาน 64 ทีละ 5 บิต
 * บิตที่ 6 เป็นตัวบอกว่ายังมีไบต์ต่อ ส่วนบิตล่างสุดบอกว่าเป็นค่าลบ
 *
 * คืนอาร์เรย์ว่างเมื่อสตริงพัง แทนที่จะโยน error หรือคืนพิกัดเพี้ยน
 * เพราะเส้นทางที่ผิดเพี้ยนอันตรายกว่าการบอกตรงๆ ว่าคำนวณเส้นทางไม่ได้
 */
export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  if (!encoded) return []

  const factor = 10 ** precision
  const points: LatLng[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let result = 0
      let shift = 0
      let byte: number

      do {
        if (index >= encoded.length) return []
        byte = encoded.charCodeAt(index++) - 63
        if (byte < 0 || byte > 63) return []
        result |= (byte & 0x1f) << shift
        shift += 5
        // ค่าหนึ่งตัวใช้ได้ไม่เกิน 6 ไบต์ ถ้าเกินแปลว่าสตริงพัง
        if (shift > 30) return []
      } while (byte >= 0x20)

      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 'lat') lat += delta
      else lng += delta
    }

    const point = { lat: lat / factor, lng: lng / factor }
    // พิกัดนอกโลกแปลว่าถอดผิดมาตั้งแต่ต้น ทิ้งทั้งเส้นดีกว่าวาดเส้นที่เชื่อไม่ได้
    if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return []
    points.push(point)
  }

  return points
}
