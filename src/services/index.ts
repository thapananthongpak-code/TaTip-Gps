import { compositeGeocodingService } from './impl/compositeGeocodingService'
import { googleGeocodingService } from './impl/googleGeocodingService'
import { googleRoutingService } from './impl/googleRoutingService'
import { osmMapService } from './impl/osmMapService'
import { osrmRoutingService } from './impl/osrmRoutingService'
import { overpassObstacleService } from './impl/overpassObstacleService'
import { appSpeechService } from './impl/appSpeechService'
import { USE_GOOGLE } from './config'
import type {
  GeocodingService,
  MapService,
  ObstacleService,
  RoutingService,
  SpeechService,
} from './interfaces'

/**
 * จุดรวมของ service ทั้งหมด (composition root)
 * แอปทั้งแอปต้อง import จากไฟล์นี้เท่านั้น — ห้าม import จาก impl/ โดยตรง
 * เวลาจะสลับผู้ให้บริการ (เช่น OSM -> Google Maps) แก้แค่บรรทัดที่ผูก implementation ในไฟล์นี้
 */
export const mapService: MapService = osmMapService

/**
 * แอปพูดด้วยเสียงของตัวเองก่อน และถอยไปให้โปรแกรมอ่านหน้าจออ่านแทนเมื่อพูดเองไม่ได้
 * สลับกันเองอัตโนมัติ ไม่มีตัวเลือกให้ผู้ใช้ตั้งค่า
 */
export const speechService: SpeechService = appSpeechService

/**
 * เลือกผู้ให้บริการจากการตั้งค่า ไม่ใช่จากการแก้โค้ด
 *
 * ตั้งค่าคีย์ไว้ = ใช้ Google, ไม่ได้ตั้ง = ใช้ชุดฟรีเดิมต่อไป
 * สำคัญที่ต้องมีทางถอย เพราะแอปนี้เป็นเครื่องมือที่คนใช้เดินทางจริง
 * ถ้าคีย์หมดอายุ งบหมด หรือยังไม่ได้ตั้งค่า ต้องยังเดินทางได้ ไม่ใช่เปิดมาแล้วใช้ไม่ได้
 */
export const geocodingService: GeocodingService = USE_GOOGLE
  ? googleGeocodingService
  : compositeGeocodingService

export const routingService: RoutingService = USE_GOOGLE ? googleRoutingService : osrmRoutingService

/** ตรวจสิ่งกีดขวางบนเส้นทางจากข้อมูลแผนที่ */
export const obstacleService: ObstacleService = overpassObstacleService

export type { GeocodingService, MapService, ObstacleService, RoutingService, SpeechService }
export * from './config'
