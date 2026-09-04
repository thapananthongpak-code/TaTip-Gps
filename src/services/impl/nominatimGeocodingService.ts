import { NOMINATIM_BASE_URL, NOMINATIM_MIN_INTERVAL_MS } from '@/services/config'
import type { GeocodingService, SearchOptions } from '@/services/interfaces'
import type { LatLng, Place } from '@/types'
import { createTtlCache } from '@/utils/cache'
import { fetchJson } from './httpClient'
import { createRateLimiter } from './requestQueue'

/** รูปแบบข้อมูลดิบของ Nominatim — ใช้เฉพาะในไฟล์นี้ ไม่รั่วออกไปนอก service */
interface NominatimPlace {
  place_id: number
  osm_id?: number
  lat: string
  lon: string
  name?: string
  display_name: string
  category?: string
  type?: string
  address?: Record<string, string>
  boundingbox?: [string, string, string, string]
}

const CACHE_TTL_MS = 10 * 60 * 1000
const searchCache = createTtlCache<Place[]>(CACHE_TTL_MS)
const reverseCache = createTtlCache<Place | null>(CACHE_TTL_MS)
const schedule = createRateLimiter(NOMINATIM_MIN_INTERVAL_MS)

/** ปัดพิกัดให้หยาบลง (~11 เมตร) เพื่อให้ตำแหน่งใกล้ๆ กันใช้ cache ร่วมกันได้ */
const coordKey = (p: LatLng) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`

function toPlace(raw: NominatimPlace): Place {
  const shortName = raw.name?.trim() || raw.display_name.split(',')[0].trim()
  return {
    id: String(raw.place_id),
    name: shortName,
    address: raw.display_name,
    location: { lat: Number(raw.lat), lng: Number(raw.lon) },
    category: raw.type ?? raw.category,
    boundingBox: raw.boundingbox
      ? {
          southWest: { lat: Number(raw.boundingbox[0]), lng: Number(raw.boundingbox[2]) },
          northEast: { lat: Number(raw.boundingbox[1]), lng: Number(raw.boundingbox[3]) },
        }
      : undefined,
  }
}

/**
 * GeocodingService บน Nominatim
 *
 * มาตรการกัน rate limit (นโยบาย: ไม่เกิน 1 คำขอ/วินาที) ทำสามชั้น:
 * 1. UI debounce 1 วินาที (ดู useSearch)
 * 2. cache ผลลัพธ์ที่ค้นซ้ำ — ไม่ยิงเลยถ้าเคยค้นแล้ว
 * 3. ตัวคุมคิวที่นี่ บังคับระยะห่างจริงระหว่างคำขอทุกชนิด
 */
export const nominatimGeocodingService: GeocodingService = {
  async search(query: string, options: SearchOptions = {}): Promise<Place[]> {
    const trimmed = query.trim()
    if (trimmed.length < 2) return []

    const { language = 'th', limit = 5, near, signal } = options
    const cacheKey = `${language}|${limit}|${near ? coordKey(near) : '-'}|${trimmed.toLowerCase()}`

    const cached = searchCache.get(cacheKey)
    if (cached) return cached

    const params = new URLSearchParams({
      q: trimmed,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(limit),
      'accept-language': language,
    })

    // จัดอันดับผลลัพธ์ที่อยู่ใกล้ตัวผู้ใช้ก่อน โดยไม่ตัดผลลัพธ์นอกกรอบทิ้ง (bounded=0)
    if (near) {
      const d = 0.3
      params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`)
      params.set('bounded', '0')
    }

    const raw = await schedule(() =>
      fetchJson<NominatimPlace[]>(`${NOMINATIM_BASE_URL}/search?${params}`, { signal }),
    )

    const places = raw.map(toPlace)
    searchCache.set(cacheKey, places)
    return places
  },

  async reverse(location: LatLng, options: SearchOptions = {}): Promise<Place | null> {
    const { language = 'th', signal } = options
    const cacheKey = `${language}|${coordKey(location)}`

    const cached = reverseCache.get(cacheKey)
    if (cached !== undefined) return cached

    const params = new URLSearchParams({
      lat: String(location.lat),
      lon: String(location.lng),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '18', // ระดับบ้านเลขที่/อาคาร — ละเอียดพอสำหรับบอกว่า "คุณอยู่ตรงไหน"
      'accept-language': language,
    })

    const raw = await schedule(() =>
      fetchJson<NominatimPlace | { error: string }>(`${NOMINATIM_BASE_URL}/reverse?${params}`, {
        signal,
      }),
    )

    const place = 'error' in raw ? null : toPlace(raw)
    reverseCache.set(cacheKey, place)
    return place
  },
}
