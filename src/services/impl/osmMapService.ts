import type { MapService, MapTileConfig } from '@/services/interfaces'
import type { BoundingBox, LatLng } from '@/types'
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  OSM_ATTRIBUTION,
  OSM_MAX_ZOOM,
  OSM_TILE_URL,
} from '@/services/config'

const EARTH_RADIUS_M = 6_371_008.8
const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/**
 * MapService บน OpenStreetMap
 * คำนวณระยะ/ทิศด้วยสูตร haversine ตรงๆ ไม่ผูกกับ Leaflet
 * เพื่อให้ย้ายไปผู้ให้บริการแผนที่อื่นได้โดยไม่ต้องแก้ตัวคำนวณ
 */
export const osmMapService: MapService = {
  getTileConfig(): MapTileConfig {
    return { urlTemplate: OSM_TILE_URL, attribution: OSM_ATTRIBUTION, maxZoom: OSM_MAX_ZOOM }
  },

  getDefaultCenter: () => DEFAULT_CENTER,

  getDefaultZoom: () => DEFAULT_ZOOM,

  distanceBetween(a: LatLng, b: LatLng): number {
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
  },

  bearingBetween(a: LatLng, b: LatLng): number {
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const dLng = toRad(b.lng - a.lng)
    const y = Math.sin(dLng) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
    return (toDeg(Math.atan2(y, x)) + 360) % 360
  },

  boundsOf(points: LatLng[]): BoundingBox | null {
    if (points.length === 0) return null
    let minLat = points[0].lat
    let maxLat = points[0].lat
    let minLng = points[0].lng
    let maxLng = points[0].lng
    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lng < minLng) minLng = p.lng
      if (p.lng > maxLng) maxLng = p.lng
    }
    return { southWest: { lat: minLat, lng: minLng }, northEast: { lat: maxLat, lng: maxLng } }
  },
}
