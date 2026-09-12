/** ชนิดของจุดเสี่ยงบนเส้นทาง */
export type HazardKind =
  /** สี่แยก — ต้องระวังรถจากหลายทิศ */
  | 'crossroads'
  /** ถนนใหญ่ที่มีชื่อ — มักต้องข้ามและรถเร็ว */
  | 'major-road'

/** ขนาดตัวอักษรที่ผู้ใช้ปรับได้ — สำคัญมากสำหรับผู้ที่สายตาเลือนราง */
export type FontScale = 'normal' | 'large' | 'x-large'

/** ธีมสี — 'system' คือตามการตั้งค่าของเครื่อง */
export type ThemePreference = 'system' | 'light' | 'dark'

/** ค่าตั้งค่าทั้งหมดของแอป เก็บบนเครื่องผู้ใช้ */
export interface AppSettings {
  fontScale: FontScale
  theme: ThemePreference
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontScale: 'normal',
  theme: 'system',
}
