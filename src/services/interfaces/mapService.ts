import type { BoundingBox, LatLng } from '@/types'

/** ค่าตั้งต้นของชั้นแผนที่ — ครอบรายละเอียดของ Leaflet/OSM ไว้ */
export interface MapTileConfig {
  urlTemplate: string
  attribution: string
  maxZoom: number
}

/**
 * ข้อมูลที่ MapView ต้องใช้ในการวาดแผนที่ โดยไม่ผูกกับ Leaflet โดยตรง
 * ถ้าย้ายไป Google Maps: เขียน implementation ใหม่ที่คืน config ของ Google แทน
 */
export interface MapService {
  getTileConfig(): MapTileConfig
  getDefaultCenter(): LatLng
  getDefaultZoom(): number
  /** ระยะห่างระหว่างสองจุด (เมตร) */
  distanceBetween(a: LatLng, b: LatLng): number
  /** ทิศจาก a ไป b (องศา 0-360) ใช้บอกทางด้วยเสียง */
  bearingBetween(a: LatLng, b: LatLng): number
  /** กรอบครอบชุดพิกัด สำหรับ zoom ให้เห็นทั้งเส้นทาง */
  boundsOf(points: LatLng[]): BoundingBox | null
}
