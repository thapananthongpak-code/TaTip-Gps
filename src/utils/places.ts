import type { Place } from '@/types'

/**
 * ชื่อที่อ่านออกเสียงได้เสมอ
 *
 * สถานที่จำนวนมากใน OSM ไม่มีชื่อ (ตู้เอทีเอ็ม ห้องน้ำสาธารณะ ป้ายรถเมล์เล็กๆ)
 * ถ้าปล่อยชื่อว่าง ผู้ใช้ที่ฟังอย่างเดียวจะได้ยินแค่ความเงียบแล้วไม่รู้ว่ามีรายการอยู่
 * จึงใช้ชื่อหมวดแทนเสมอ
 */
export function placeLabel(place: Place, t: (key: string) => string): string {
  if (place.name) return place.name
  return place.categoryKey ? t(`nearby.unnamed.${place.categoryKey}`) : t('search.resultsLabel')
}
