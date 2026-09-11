import { NEARBY_RADIUS_M } from '@/services/config'
import type { NearbyOptions, PlacesService } from '@/services/interfaces'
import type { LatLng, Place, PlaceCategory, ServiceLanguage } from '@/types'
import { elementLocation, overpassQuery, type OverpassElement } from './overpassClient'

/**
 * ตัวกรอง Overpass ของแต่ละหมวด
 *
 * จัดกลุ่มตามสิ่งที่ "ผู้ใช้ต้องการ" ไม่ใช่ตามโครงสร้างแท็กของ OSM
 * เช่น หมวดเดินทางรวมทั้งป้ายรถเมล์ สถานีรถไฟฟ้า และท่าเรือไว้ด้วยกัน
 * เพราะคนที่กำลังหาทางกลับบ้านไม่ได้สนใจว่ามันถูกแมปด้วยแท็กไหน
 */
const CATEGORY_FILTERS: Record<PlaceCategory, string[]> = {
  transit: [
    'nwr[highway=bus_stop]',
    'nwr[public_transport=platform]',
    'nwr[railway=station]',
    'nwr[railway=halt]',
    'nwr[amenity=ferry_terminal]',
  ],
  convenience: [
    'nwr[shop=convenience]',
    'nwr[shop=supermarket]',
    'nwr[shop=mall]',
    'nwr[amenity=marketplace]',
  ],
  food: ['nwr[amenity=restaurant]', 'nwr[amenity=cafe]', 'nwr[amenity=fast_food]'],
  pharmacy: ['nwr[amenity=pharmacy]', 'nwr[healthcare=pharmacy]'],
  hospital: ['nwr[amenity=hospital]', 'nwr[amenity=clinic]', 'nwr[amenity=doctors]'],
  bank: ['nwr[amenity=bank]', 'nwr[amenity=atm]'],
  toilets: ['nwr[amenity=toilets]'],
  government: [
    'nwr[amenity=police]',
    'nwr[amenity=post_office]',
    'nwr[amenity=townhall]',
    'nwr[office=government]',
  ],
}

/** แท็กที่บอกว่า element นี้คืออะไร ใช้ตอนไม่มีชื่อ */
const KIND_TAGS = [
  'amenity',
  'shop',
  'railway',
  'highway',
  'public_transport',
  'healthcare',
  'office',
] as const

/** ชื่อในภาษาที่ผู้ใช้เลือกมาก่อน แล้วค่อยถอยไปชื่อกลางและชื่ออังกฤษ */
function pickName(tags: Record<string, string>, language: ServiceLanguage): string | null {
  return tags[`name:${language}`] || tags.name || tags['name:en'] || tags['name:th'] || null
}

function toPlace(
  element: OverpassElement,
  location: LatLng,
  language: ServiceLanguage,
  category: PlaceCategory,
): Place {
  const tags = element.tags ?? {}
  const kind = KIND_TAGS.map((key) => tags[key]).find(Boolean)

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
    category: kind,
    categoryKey: category,
  }
}

/**
 * PlacesService บน Overpass API
 *
 * เติมช่องโหว่ใหญ่ของการค้นหาด้วยชื่ออย่างเดียว:
 * คนตาบอดมองป้ายร้านไม่เห็น จึงไม่รู้ว่ารอบตัวมีอะไรให้เอาไปพิมพ์ค้นหา
 * การถามว่า "รอบตัวมีอะไรบ้าง" จึงตรงกับวิธีที่เขาใช้งานจริงมากกว่า
 */
export const overpassPlacesService: PlacesService = {
  async findNearby(
    category: PlaceCategory,
    center: LatLng,
    options: NearbyOptions = {},
  ): Promise<Place[]> {
    const { radiusM = NEARBY_RADIUS_M, language = 'th', limit = 12, signal } = options

    const lat = center.lat.toFixed(5)
    const lng = center.lng.toFixed(5)
    const body = CATEGORY_FILTERS[category]
      .map((filter) => `  ${filter}(around:${radiusM},${lat},${lng});`)
      .join('\n')

    // ขอเผื่อไว้มากกว่าที่จะแสดง เพราะต้องคัดรายการที่ไม่มีพิกัดใช้ได้ออกก่อน
    const query = `[out:json][timeout:25];\n(\n${body}\n);\nout center tags ${limit * 3};`

    const elements = await overpassQuery(query, {
      signal,
      cacheKey: `nearby|${category}|${language}|${radiusM}|${lat},${lng}`,
    })

    const places = elements.flatMap((element) => {
      const location = elementLocation(element)
      return location ? [toPlace(element, location, language, category)] : []
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
