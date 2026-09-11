import type { LatLng } from './geo'

/** ผู้ติดต่อฉุกเฉิน — เก็บใน localStorage ของเครื่องผู้ใช้เท่านั้น ไม่เคยส่งขึ้นเซิร์ฟเวอร์ */
export interface EmergencyContact {
  id: string
  name: string
  /** เบอร์โทรศัพท์ ใช้สร้างลิงก์ sms: */
  phone: string
}

/** ชนิดของจุดเสี่ยงบนเส้นทาง */
export type HazardKind =
  /** สี่แยก — ต้องระวังรถจากหลายทิศ */
  | 'crossroads'
  /** ถนนใหญ่ที่มีชื่อ — มักต้องข้ามและรถเร็ว */
  | 'major-road'

/** เซสชันแชร์ตำแหน่งให้คนที่ไว้ใจติดตาม */
export interface ShareSession {
  /** เวลาที่เริ่มแชร์ (epoch ms) */
  startedAt: number
  /** เวลาที่ลิงก์หมดอายุ (epoch ms) */
  expiresAt: number
  /** ชื่อจุดหมาย ถ้ากำลังนำทางอยู่ */
  destinationName?: string
}

/** ข้อมูลที่ฝังอยู่ในลิงก์แชร์ตำแหน่ง (อยู่ใน URL fragment จึงไม่ถูกส่งไปยังเซิร์ฟเวอร์) */
export interface SharePayload {
  /** ตำแหน่ง ณ เวลาที่สร้างลิงก์ */
  position: LatLng
  /** ความคลาดเคลื่อน (เมตร) */
  accuracy: number
  /** เวลาที่บันทึกตำแหน่ง (epoch ms) */
  capturedAt: number
  /** เวลาหมดอายุของลิงก์ (epoch ms) */
  expiresAt: number
  destination?: {
    name: string
    location: LatLng
  }
}

/** ขนาดตัวอักษรที่ผู้ใช้ปรับได้ — สำคัญมากสำหรับผู้ที่สายตาเลือนราง */
export type FontScale = 'normal' | 'large' | 'x-large'

/** ธีมสี — 'system' คือตามการตั้งค่าของเครื่อง */
export type ThemePreference = 'system' | 'light' | 'dark'

/** ค่าตั้งค่าทั้งหมดของแอป เก็บบนเครื่องผู้ใช้ */
export interface AppSettings {
  fontScale: FontScale
  theme: ThemePreference
  emergencyContacts: EmergencyContact[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontScale: 'normal',
  theme: 'system',
  emergencyContacts: [],
}
