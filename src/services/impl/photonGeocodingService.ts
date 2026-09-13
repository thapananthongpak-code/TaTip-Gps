import { PHOTON_BASE_URL, PHOTON_MIN_INTERVAL_MS } from '@/services/config'
import type { GeocodingService, SearchOptions } from '@/services/interfaces'
import { ServiceError } from '@/types'
import type { Place } from '@/types'
import { fetchJson } from './httpClient'
import { createRateLimiter } from './requestQueue'

/** รูปแบบ GeoJSON ที่ Photon ตอบกลับ — ไม่รั่วออกไปนอกไฟล์นี้ */
interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string
    street?: string
    housenumber?: string
    district?: string
    city?: string
    state?: string
    country?: string
    osm_key?: string
    osm_value?: string
    osm_id?: number
    osm_type?: string
  }
}

interface PhotonResponse {
  features?: PhotonFeature[]
}

const schedule = createRateLimiter(PHOTON_MIN_INTERVAL_MS)

/**
 * ชนิดที่เป็น "สถานที่ที่คนตั้งใจไป" จริงๆ
 *
 * Photon คืนทางเท้าและถนนที่ชื่อพ้องกันมาปนด้วย เช่นค้น "เซ็นทรัลเวิล"
 * แล้วได้ทางเท้าชื่อ "เซ็นทรัลเวิลด์สแควร์" มาเป็นอันดับหนึ่ง
 * ซึ่งพิกัดถูกแต่ไม่ใช่สิ่งที่ผู้ใช้หมายถึง จึงดันชนิดเหล่านี้ขึ้นก่อน
 */
const DESTINATION_KEYS = new Set([
  'amenity',
  'shop',
  'tourism',
  'leisure',
  'office',
  'healthcare',
  'railway',
  'public_transport',
  'aeroway',
  'building',
  'place',
])

/**
 * คะแนนของผลลัพธ์ ยิ่งน้อยยิ่งดี — เรียงตามลำดับความสำคัญสามชั้น
 *
 * 1. ชื่อตรงกับที่พิมพ์แค่ไหน สำคัญที่สุด เพราะผู้ใช้พิมพ์ชื่อที่เขาตั้งใจไป
 *    ค้น "เซ็นทรัลเวิล" แล้วได้ "ดิ ออฟฟิศเศส แอท เซ็นทรัลเวิลด์" ขึ้นก่อน
 *    ทั้งที่มี "เซ็นทรัลเวิลด์" อยู่ในผลลัพธ์ คือการจัดอันดับที่ผิด
 * 2. เป็นสถานที่ที่คนตั้งใจไป ไม่ใช่ทางเท้าหรือถนนที่ชื่อพ้องกัน
 * 3. ชื่อสั้นกว่าชนะ เพราะมักเป็นชื่อหลัก ส่วนชื่อยาวมักเป็นสิ่งที่อยู่ "ภายใน" สถานที่นั้น
 */
function rank(feature: PhotonFeature, query: string): number {
  const name = (feature.properties?.name ?? '').toLowerCase()
  const needle = query.trim().toLowerCase()

  const nameScore = name.startsWith(needle) ? 0 : name.includes(needle) ? 1 : 2
  const keyScore = DESTINATION_KEYS.has(feature.properties?.osm_key ?? '') ? 0 : 1
  const lengthScore = Math.min(name.length / 40, 1)

  return nameScore * 10 + keyScore * 2 + lengthScore
}

function toPlace(feature: PhotonFeature): Place | null {
  const coordinates = feature.geometry?.coordinates
  const properties = feature.properties
  if (!coordinates || !properties) return null

  const [lng, lat] = coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null

  const name = properties.name?.trim() || properties.street?.trim()
  if (!name) return null

  return {
    // Photon ไม่มี place_id แบบ Nominatim จึงประกอบจาก osm type กับ id
    id: `photon/${properties.osm_type ?? 'n'}/${properties.osm_id ?? `${lat},${lng}`}`,
    name,
    address: [properties.housenumber, properties.street, properties.district, properties.city]
      .filter(Boolean)
      .join(' ')
      .trim(),
    location: { lat, lng },
    category: properties.osm_value ?? properties.osm_key,
  }
}

/**
 * GeocodingService บน Photon
 *
 * ใช้เป็นตัวสำรองของ Nominatim ไม่ได้ใช้เป็นตัวหลัก เพราะ Nominatim
 * จัดอันดับและให้ที่อยู่เต็มได้ดีกว่าเมื่อคำค้นถูกต้องอยู่แล้ว
 * ดู compositeGeocodingService สำหรับลำดับการเรียก
 */
export const photonGeocodingService: GeocodingService = {
  async search(query: string, options: SearchOptions = {}): Promise<Place[]> {
    const trimmed = query.trim()
    if (trimmed.length < 2) return []

    const { limit = 5, near, signal } = options
    const params = new URLSearchParams({ q: trimmed, limit: String(limit * 2) })

    // ถ่วงน้ำหนักผลลัพธ์ที่อยู่ใกล้ผู้ใช้ก่อน
    if (near) {
      params.set('lat', near.lat.toFixed(5))
      params.set('lon', near.lng.toFixed(5))
    }

    const data = await fetchJson<PhotonResponse>(`${PHOTON_BASE_URL}?${params}`, {
      signal,
      schedule,
    })
    if (!data || !Array.isArray(data.features)) throw new ServiceError('PROVIDER_ERROR')

    return data.features
      .slice()
      .sort((a, b) => rank(a, trimmed) - rank(b, trimmed))
      .flatMap((feature) => {
        const place = toPlace(feature)
        return place ? [place] : []
      })
      .slice(0, limit)
  },

  /**
   * Photon มี /reverse แต่โปรเจกต์นี้ไม่ใช้
   * เพราะปุ่ม "ฉันอยู่ที่ไหน" ต้องการที่อยู่เต็มแบบที่ Nominatim ให้ได้ดีกว่า
   */
  async reverse(): Promise<Place | null> {
    return null
  },
}
