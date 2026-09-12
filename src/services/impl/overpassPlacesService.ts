import { NEARBY_RADIUS_M } from '@/services/config'
import type { NearbyOptions, PlacesService } from '@/services/interfaces'
import type { LatLng, Place, PlaceCategory, ServiceLanguage } from '@/types'
import { elementLocation, overpassQuery, type OverpassElement } from './overpassClient'

/**
 * แท็ก OSM ของแต่ละหมวด
 *
 * จัดกลุ่มตามสิ่งที่ "ผู้ใช้ต้องการ" ไม่ใช่ตามโครงสร้างแท็กของ OSM
 * เช่น หมวดเดินทางรวมป้ายรถเมล์ สถานีรถไฟฟ้า และท่าเรือไว้ด้วยกัน
 * เพราะคนที่กำลังหาทางกลับบ้านไม่ได้สนใจว่ามันถูกแมปด้วยแท็กไหน
 */
const CATEGORY_TAGS: Record<PlaceCategory, Partial<Record<string, string[]>>> = {
  transit: {
    highway: ['bus_stop'],
    railway: ['station', 'halt'],
    public_transport: ['platform'],
    amenity: ['ferry_terminal'],
  },
  convenience: {
    shop: ['convenience', 'supermarket', 'mall'],
    amenity: ['marketplace'],
  },
  food: { amenity: ['restaurant', 'cafe', 'fast_food'] },
  pharmacy: { amenity: ['pharmacy'], healthcare: ['pharmacy'] },
  hospital: { amenity: ['hospital', 'clinic', 'doctors'] },
  bank: { amenity: ['bank', 'atm'] },
  toilets: { amenity: ['toilets'] },
  government: { amenity: ['police', 'post_office', 'townhall'], office: ['government'] },
}

const CATEGORIES = Object.keys(CATEGORY_TAGS) as PlaceCategory[]

/** ชื่อในภาษาที่ผู้ใช้เลือกมาก่อน แล้วค่อยถอยไปชื่อกลางและชื่ออังกฤษ */
function pickName(tags: Record<string, string>, language: ServiceLanguage): string | null {
  return tags[`name:${language}`] || tags.name || tags['name:en'] || tags['name:th'] || null
}

/** หมวดของแอปที่ element นี้อยู่ — null ถ้าไม่เข้าหมวดไหนเลย */
function categoryOf(tags: Record<string, string>): PlaceCategory | null {
  for (const category of CATEGORIES) {
    for (const [key, values] of Object.entries(CATEGORY_TAGS[category])) {
      if (values?.includes(tags[key])) return category
    }
  }
  return null
}

function toPlace(
  element: OverpassElement,
  location: LatLng,
  category: PlaceCategory,
  language: ServiceLanguage,
): Place {
  const tags = element.tags ?? {}
  return {
    id: `${element.type}/${element.id}`,
    // สถานที่จำนวนมากใน OSM ไม่มีชื่อ (ตู้เอทีเอ็ม ห้องน้ำสาธารณะ ป้ายรถเมล์เล็กๆ)
    // ปล่อยว่างไว้ตรงนี้แล้วให้ชั้น UI เติมชื่อหมวดตามภาษาที่เลือก
    // เพราะ service ไม่ควรรู้จักระบบแปลภาษา
    name: pickName(tags, language) ?? '',
    address: [tags['addr:street'], tags['addr:housenumber'], tags.operator, tags.brand]
      .filter(Boolean)
      .join(' ')
      .trim(),
    location,
    category: tags.amenity ?? tags.shop ?? tags.railway ?? tags.highway,
    categoryKey: category,
  }
}

/** สร้างตัวกรองของ Overpass จากตารางแท็กด้านบน จะได้ไม่ต้องเขียนสองที่ให้ตรงกันเอง */
function buildQuery(center: LatLng, radiusM: number, limit: number): string {
  const around = `around:${radiusM},${center.lat.toFixed(5)},${center.lng.toFixed(5)}`
  const byKey = new Map<string, Set<string>>()

  for (const category of CATEGORIES) {
    for (const [key, values] of Object.entries(CATEGORY_TAGS[category])) {
      const bucket = byKey.get(key) ?? new Set<string>()
      for (const value of values ?? []) bucket.add(value)
      byKey.set(key, bucket)
    }
  }

  const filters = [...byKey.entries()].map(
    ([key, values]) => `nwr(${around})[${key}~"^(${[...values].join('|')})$"];`,
  )
  return `[out:json][timeout:40];\n(\n${filters.join('\n')}\n);\nout center tags ${limit};`
}

/**
 * ดึงสถานที่ "ทุกหมวดพร้อมกันในคำขอเดียว" แล้วค่อยกรองตามหมวดในเครื่อง
 *
 * เดิมยิงแยกทีละหมวดตามที่ผู้ใช้กด ซึ่งพังในการใช้งานจริง:
 * ผู้ใช้กดดูหลายหมวดติดกันเป็นเรื่องปกติ พอกดหมวดที่สามหรือสี่
 * Overpass จะตอบ 429 แล้วแอปขึ้นว่า "บริการแผนที่ไม่ตอบสนอง"
 * (ทดสอบจริงแล้วพบว่าหมวดถัดมาล้มเหลวภายใน 13 มิลลิวินาที ซึ่งคือ cooldown ฝั่งเรา)
 *
 * วัดแล้วคำขอรวมทุกหมวดใช้เวลา 2.3 วินาที ได้ 463 จุดครบทุกหมวด
 * เท่ากับคำขอเดียวแทนที่จะเป็นแปดคำขอ และการกดหมวดหลังจากนั้นตอบทันทีจาก cache
 */
export const overpassPlacesService: PlacesService = {
  async findNearby(
    category: PlaceCategory,
    center: LatLng,
    options: NearbyOptions = {},
  ): Promise<Place[]> {
    const { radiusM = NEARBY_RADIUS_M, language = 'th', limit = 12, signal } = options

    const elements = await overpassQuery(buildQuery(center, radiusM, 600), {
      signal,
      // cache ร่วมกันทุกหมวด กดหมวดไหนหลังจากนี้ก็ไม่ยิงซ้ำ
      cacheKey: `nearby|${language}|${radiusM}|${center.lat.toFixed(4)},${center.lng.toFixed(4)}`,
    })

    const places = elements.flatMap((element) => {
      const tags = element.tags
      if (!tags) return []
      if (categoryOf(tags) !== category) return []
      const location = elementLocation(element)
      return location ? [toPlace(element, location, category, language)] : []
    })

    // ตัดรายการซ้ำ: ห้างใหญ่ถูกแมปทั้งเป็นจุดและเป็นรูปหลายเหลี่ยม จะโผล่สองครั้ง
    const seen = new Set<string>()
    const unique = places.filter((place) => {
      const key = `${place.name}|${place.location.lat.toFixed(4)},${place.location.lng.toFixed(4)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return unique.slice(0, limit)
  },
}
