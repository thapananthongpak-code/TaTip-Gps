import { API_BASE_URL } from '@/services/config'
import type { GeocodingService, SearchOptions } from '@/services/interfaces'
import { ServiceError } from '@/types'
import type { LatLng, Place } from '@/types'
import { createTtlCache } from '@/utils/cache'
import { fetchJson } from './httpClient'

interface ProxyPlace {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  category?: string
}

/**
 * cache ผลค้นหาซ้ำ
 *
 * ที่นี่ cache ไม่ได้มีไว้แค่ให้เร็วขึ้นเหมือนตอนใช้บริการฟรี แต่มีไว้ประหยัดเงินด้วย
 * Places API คิดเงินทุกคำขอ การกดค้นคำเดิมซ้ำจึงไม่ควรเสียเงินสองรอบ
 */
const searchCache = createTtlCache<Place[]>(10 * 60 * 1000, 50)
const reverseCache = createTtlCache<Place | null>(5 * 60 * 1000, 30)

/** ปัดพิกัดให้หยาบลงก่อนทำคีย์ cache — ขยับไม่กี่เมตรไม่เปลี่ยนคำตอบว่าอยู่ถนนอะไร */
const coordKey = (at: LatLng) => `${at.lat.toFixed(4)},${at.lng.toFixed(4)}`

function toPlace(raw: ProxyPlace): Place {
  return {
    id: raw.id || `${raw.lat},${raw.lng}`,
    name: raw.name,
    address: raw.address,
    location: { lat: raw.lat, lng: raw.lng },
    category: raw.category || undefined,
  }
}

/** ทิ้งพิกัดที่ผิดรูปก่อนถึงมือส่วนนำทาง ดีกว่าปล่อยให้พาเดินไปผิดที่ */
const usable = (raw: ProxyPlace) =>
  Number.isFinite(raw.lat) &&
  Number.isFinite(raw.lng) &&
  Math.abs(raw.lat) <= 90 &&
  Math.abs(raw.lng) <= 180

/**
 * GeocodingService บน Google Places API (New) ผ่าน proxy ของเราเอง
 *
 * ไม่ยิง Google ตรงจากแอป เพราะคีย์ของ Places จำกัดด้วย HTTP referrer ไม่ได้
 * แอปที่แจกเป็นไฟล์ APK ถูกแกะดูคีย์ได้ทันที แล้วบิลจะวิ่งต่อโดยเจ้าของไม่รู้ตัว
 */
export const googleGeocodingService: GeocodingService = {
  async search(query: string, options: SearchOptions = {}): Promise<Place[]> {
    const trimmed = query.trim()
    if (trimmed.length < 2) return []

    const { language = 'th', limit = 8, near, signal } = options
    const cacheKey = `${language}|${near ? coordKey(near) : '-'}|${trimmed.toLowerCase()}`
    const cached = searchCache.get(cacheKey)
    if (cached) return cached

    const params = new URLSearchParams({ q: trimmed, lang: language })
    if (near) {
      params.set('lat', String(near.lat))
      params.set('lng', String(near.lng))
    }

    const data = await fetchJson<{ places?: ProxyPlace[] }>(
      `${API_BASE_URL}/api/places?${params}`,
      {
        signal,
      },
    )
    if (!Array.isArray(data.places)) throw new ServiceError('PROVIDER_ERROR')

    const places = data.places.filter(usable).slice(0, limit).map(toPlace)
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
      lng: String(location.lng),
      lang: language,
    })

    const data = await fetchJson<{ place?: ProxyPlace | null }>(
      `${API_BASE_URL}/api/reverse?${params}`,
      { signal },
    )
    const place = data.place && usable(data.place) ? toPlace(data.place) : null
    reverseCache.set(cacheKey, place)
    return place
  },
}
