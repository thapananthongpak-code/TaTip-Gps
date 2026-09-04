/**
 * รูปแบบการสั่นของแต่ละเหตุการณ์
 *
 * ออกแบบให้ "จำนวนจังหวะ" สื่อความหมายได้โดยไม่ต้องฟังเสียง
 * เผื่อผู้ใช้อยู่ในที่เสียงดังหรือใส่หูฟังฟังอย่างอื่นอยู่
 */
export const VIBRATION_PATTERNS = {
  /** จังหวะเดียวสั้นๆ — ยืนยันว่าแตะปุ่มติด */
  tap: [40],
  /** จังหวะเดียวยาว — ใกล้ถึงจุดเลี้ยว */
  maneuver: [180],
  /** สองจังหวะ — จุดเสี่ยงข้างหน้า (สี่แยก/ถนนใหญ่) */
  hazard: [200, 120, 200],
  /** สามจังหวะยาว — ส่งสัญญาณขอความช่วยเหลือแล้ว */
  sos: [400, 150, 400, 150, 400],
  /** จังหวะถี่ — นับถอยหลังระหว่างกดปุ่ม SOS ค้าง */
  countdown: [80],
} as const

export type VibrationPattern = keyof typeof VIBRATION_PATTERNS

export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

/**
 * สั่นตามรูปแบบที่กำหนด
 *
 * เงียบไปเฉยๆ ถ้าอุปกรณ์ไม่รองรับ (iOS Safari ยังไม่รองรับ Vibration API)
 * การสั่นจึงเป็น "ช่องทางเสริม" เสมอ ไม่ใช่ช่องทางเดียวที่ใช้สื่อสารเรื่องสำคัญ
 */
export function vibrate(pattern: VibrationPattern, enabled: boolean): void {
  if (!enabled || !isVibrationSupported()) return
  try {
    navigator.vibrate(VIBRATION_PATTERNS[pattern] as unknown as number[])
  } catch {
    // บางเบราว์เซอร์โยน error ถ้าเรียกโดยไม่มี user gesture — ไม่ใช่เรื่องคอขาดบาดตาย
  }
}
