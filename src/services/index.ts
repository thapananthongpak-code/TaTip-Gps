import { osmMapService } from './impl/osmMapService'
import type { GeocodingService, MapService, RoutingService } from './interfaces'

/**
 * จุดรวมของ service ทั้งหมด (composition root)
 * แอปทั้งแอปต้อง import จากไฟล์นี้เท่านั้น — ห้าม import จาก impl/ โดยตรง
 * เวลาจะสลับผู้ให้บริการ (เช่น OSM -> Google Maps) แก้แค่บรรทัดที่ผูก implementation ในไฟล์นี้
 */
export const mapService: MapService = osmMapService

/** Phase 2: ผูกกับ nominatimGeocodingService */
export const geocodingService: GeocodingService | null = null

/** Phase 2: ผูกกับ osrmRoutingService */
export const routingService: RoutingService | null = null

export type { GeocodingService, MapService, RoutingService }
export * from './config'
