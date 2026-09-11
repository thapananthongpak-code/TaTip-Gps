import { localSettingsService } from './impl/localSettingsService'
import { nominatimGeocodingService } from './impl/nominatimGeocodingService'
import { osmMapService } from './impl/osmMapService'
import { osrmRoutingService } from './impl/osrmRoutingService'
import { overpassObstacleService } from './impl/overpassObstacleService'
import { overpassPlacesService } from './impl/overpassPlacesService'
import { webShareService } from './impl/webShareService'
import { webSpeechService } from './impl/webSpeechService'
import type {
  GeocodingService,
  MapService,
  ObstacleService,
  PlacesService,
  RoutingService,
  SettingsService,
  ShareService,
  SpeechService,
} from './interfaces'

/**
 * จุดรวมของ service ทั้งหมด (composition root)
 * แอปทั้งแอปต้อง import จากไฟล์นี้เท่านั้น — ห้าม import จาก impl/ โดยตรง
 * เวลาจะสลับผู้ให้บริการ (เช่น OSM -> Google Maps) แก้แค่บรรทัดที่ผูก implementation ในไฟล์นี้
 */
export const mapService: MapService = osmMapService

export const speechService: SpeechService = webSpeechService

/** เก็บค่าตั้งค่าบนเครื่องผู้ใช้เท่านั้น */
export const settingsService: SettingsService = localSettingsService

/** แชร์ตำแหน่งผ่านความสามารถของเบราว์เซอร์ ไม่ผ่านเซิร์ฟเวอร์ของแอป */
export const shareService: ShareService = webShareService

/** สลับไป Google Places ในอนาคต = แก้บรรทัดนี้บรรทัดเดียว */
export const geocodingService: GeocodingService = nominatimGeocodingService

/** สลับไป Google Directions ในอนาคต = แก้บรรทัดนี้บรรทัดเดียว */
export const routingService: RoutingService = osrmRoutingService

/** ค้นหาสถานที่รอบตัวตามหมวดหมู่ — สลับไป Google Places Nearby ได้ที่บรรทัดนี้ */
export const placesService: PlacesService = overpassPlacesService

/** ตรวจสิ่งกีดขวางบนเส้นทางจากข้อมูลแผนที่ */
export const obstacleService: ObstacleService = overpassObstacleService

export type {
  GeocodingService,
  MapService,
  ObstacleService,
  PlacesService,
  RoutingService,
  SettingsService,
  ShareService,
  SpeechService,
}
export * from './config'
