import type { ServiceLanguage } from '@/types'

/** ช่วงอักขระไทยในยูนิโคด */
const THAI = /[฀-๿]/

export const hasThaiScript = (text: string): boolean => THAI.test(text)

/**
 * ข้อความนี้เข้ากับภาษาที่ผู้ใช้เลือกไว้หรือไม่
 *
 * โหมดไทยรับได้ทุกอย่าง เพราะคนไทยอ่านชื่อภาษาอังกฤษที่ปนมาได้อยู่แล้ว
 * แต่โหมดอังกฤษต้องไม่มีอักษรไทย เพราะเสียงอ่านภาษาอังกฤษออกเสียงอักษรไทยไม่ได้
 * จะกลายเป็นเงียบไปเฉยๆ กลางประโยค หรืออ่านเป็นเสียงที่ฟังไม่รู้เรื่อง
 */
export function matchesLanguage(text: string, language: ServiceLanguage): boolean {
  if (!text.trim()) return false
  return language === 'th' || !hasThaiScript(text)
}

/**
 * ชื่อถนนที่ใช้พูดได้จริงในภาษาที่เลือก — undefined แปลว่าให้ข้ามชื่อถนนไป
 *
 * ⚠️ วัดจริงแล้ว: ชื่อถนนที่ OSRM ส่งมาในกรุงเทพเป็นภาษาไทย 100%
 * ในโหมดอังกฤษจึงได้ประโยคปนสองภาษาอย่าง "turn left near ถนนเพลินจิต" ทุกครั้ง
 *
 * การข้ามชื่อถนนไปไม่ได้ทำให้เสียข้อมูลอย่างที่คิด เพราะเสียงภาษาอังกฤษ
 * อ่านอักษรไทยไม่ออกอยู่แล้ว ผู้ใช้จึงไม่เคยได้ยินชื่อนั้นตั้งแต่แรก
 * ได้ประโยคที่สะอาดและจังหวะการพูดที่ไม่สะดุดกลับมาแทน
 */
export function speakableStreet(
  streetName: string | undefined,
  language: ServiceLanguage,
): string | undefined {
  if (!streetName) return undefined
  return matchesLanguage(streetName, language) ? streetName : undefined
}

/**
 * ตัดส่วนของที่อยู่ที่เป็นคนละภาษากับที่ผู้ใช้เลือกออก
 *
 * Nominatim แปลที่อยู่ให้เท่าที่ OSM มีคำแปล ส่วนที่ไม่มีจะถูกส่งกลับมาเป็นภาษาเดิม
 * ผลคือที่อยู่ภาษาอังกฤษมีคำไทยแทรกกลาง เช่น
 *   "Kamphaeng Phet 5 Road, ชุมชนสระแก้ว, Thung Phaya Thai Subdistrict, Bangkok"
 * ซึ่งเมื่ออ่านออกเสียงจะสะดุดตรงกลางโดยไม่มีเหตุผลให้ผู้ใช้เข้าใจ
 *
 * คืนที่อยู่เดิมทั้งหมดถ้าตัดแล้วไม่เหลืออะไรเลย เพราะที่อยู่ที่อ่านยาก
 * ยังดีกว่าไม่มีที่อยู่ให้เลย
 */
export function addressForLanguage(address: string, language: ServiceLanguage): string {
  if (language === 'th') return address
  const kept = address
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !hasThaiScript(part))
  return kept.length > 0 ? kept.join(', ') : address
}
