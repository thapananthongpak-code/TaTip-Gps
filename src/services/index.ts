import { nominatimGeocodingService } from './impl/nominatimGeocodingService'
import { osmMapService } from './impl/osmMapService'
import { osrmRoutingService } from './impl/osrmRoutingService'
import { webSpeechService } from './impl/webSpeechService'
import type { GeocodingService, MapService, RoutingService, SpeechService } from './interfaces'

/**
 * จุดรวมของ service ทั้งหมด (composition root)
 * แอปทั้งแอปต้อง import จากไฟล์นี้เท่านั้น — ห้าม import จาก impl/ โดยตรง
 * เวลาจะสลับผู้ให้บริการ (เช่น OSM -> Google Maps) แก้แค่บรรทัดที่ผูก implementation ในไฟล์นี้
 */
export const mapService: MapService = osmMapService

export const speechService: SpeechService = webSpeechService

/** สลับไป Google Places ในอนาคต = แก้บรรทัดนี้บรรทัดเดียว */
export const geocodingService: GeocodingService = nominatimGeocodingService

/** สลับไป Google Directions ในอนาคต = แก้บรรทัดนี้บรรทัดเดียว */
export const routingService: RoutingService = osrmRoutingService

export type { GeocodingService, MapService, RoutingService, SpeechService }
export * from './config'
