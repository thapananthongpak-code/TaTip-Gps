import type { LatLng, Place, Route, ServiceLanguage } from '@/types'

export interface RouteOptions {
  language?: ServiceLanguage
  signal?: AbortSignal
  /**
   * แจ้งเมื่อคำขอล้มเหลวและกำลังจะลองใหม่
   * ระหว่างนำทาง ผู้ใช้ต้องรู้ทันทีว่าระบบกำลังสะดุด ไม่ใช่รู้ตอนที่ยอมแพ้ไปแล้ว
   */
  onRetry?: (attempt: number) => void
}

/**
 * คำนวณเส้นทางเดินเท้า
 * implementation ปัจจุบัน: OSRM demo server (walking profile)
 * ถ้าจะย้ายไป Google Directions ในอนาคต แก้แค่ implementation
 */
export interface RoutingService {
  getWalkingRoute(origin: LatLng, destination: Place, options?: RouteOptions): Promise<Route>
}
