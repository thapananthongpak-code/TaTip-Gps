import type { LatLng, Obstacle, ServiceLanguage } from '@/types'

export interface ObstacleScanOptions {
  /** ระยะจากเส้นทางที่ถือว่าเกี่ยวข้อง (เมตร) */
  corridorM?: number
  language?: ServiceLanguage
  signal?: AbortSignal
}

/**
 * ตรวจหาสิ่งกีดขวางบนเส้นทางเดิน
 *
 * ⚠️ ขอบเขตที่ทำได้จริง: ตรวจจาก "ข้อมูลแผนที่ที่มีคนแมปไว้" เท่านั้น
 * จับได้: บันได ประตูกั้น เสากั้น ขอบทางสูง เขตก่อสร้าง ทางข้ามที่ไม่มีเบรลล์บล็อก
 * จับไม่ได้: มอเตอร์ไซค์จอดขวาง แผงลอย ถังขยะ ป้ายตั้งพื้น สายไฟห้อย ต้นไม้ล้ม
 *
 * สิ่งกีดขวางเฉพาะหน้าแบบหลังต้องใช้กล้องและการประมวลผลภาพ ซึ่งอยู่นอกขอบเขตของเว็บแอปนี้
 * ผู้ใช้ต้องรู้ข้อจำกัดนี้ชัดเจน ไม่งั้นจะไว้ใจระบบเกินจริงแล้วเลิกใช้ไม้เท้าตรวจทาง
 */
export interface ObstacleService {
  scanRoute(geometry: LatLng[], options?: ObstacleScanOptions): Promise<Obstacle[]>
}
