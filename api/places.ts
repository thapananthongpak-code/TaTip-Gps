import { badRequest, json, readLanguage, readLatLng, serverKey, unauthorized } from './_shared'

export const config = { runtime: 'edge' }

interface GooglePlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  primaryType?: string
}

/**
 * ค้นหาสถานที่ด้วยชื่อผ่าน Places API (New) — Text Search
 *
 * เลือก Text Search ไม่ใช่ Autocomplete เพราะแอปนี้ค้นเมื่อผู้ใช้กดปุ่มค้นหา
 * ไม่ได้ค้นระหว่างพิมพ์ทีละตัวอักษร (ตั้งใจให้เป็นแบบนั้นเพื่อไม่ให้เสียงรบกวน
 * ผู้ใช้ที่มองไม่เห็นระหว่างพิมพ์) Autocomplete จึงคิดเงินโดยไม่ได้ประโยชน์
 */
export default async function handler(request: Request): Promise<Response> {
  const blocked = unauthorized(request)
  if (blocked) return blocked

  const key = serverKey()
  if (!key) return json({ error: 'GOOGLE_MAPS_SERVER_KEY is not configured' }, 503)

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? '').trim()
  if (query.length < 2) return badRequest('q must be at least 2 characters')
  if (query.length > 200) return badRequest('q is too long')

  const near = readLatLng(searchParams)
  const language = readLanguage(searchParams)

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      /*
       * ขอเฉพาะฟิลด์ที่แอปใช้จริง
       * Google คิดราคาเป็นชั้นตามฟิลด์ที่ขอ การขอเกินคือการจ่ายเพิ่มเปล่าๆ
       * และฟิลด์อย่างรูปภาพหรือรีวิวไม่มีประโยชน์กับผู้ใช้ที่มองไม่เห็นอยู่แล้ว
       */
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: language,
      regionCode: 'TH',
      maxResultCount: 8,
      ...(near
        ? {
            // ถ่วงน้ำหนักให้ผลใกล้ตัวมาก่อน แต่ไม่ตัดผลที่อยู่ไกลทิ้ง
            // คนตาบอดอาจกำลังค้นหาที่หมายปลายทางที่อยู่คนละเขตก็ได้
            locationBias: {
              circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 20000 },
            },
          }
        : {}),
    }),
  })

  if (!response.ok) {
    // ไม่ส่งข้อความดิบของ Google กลับไป เพราะอาจมีรายละเอียดของคีย์หรือโครงการติดไปด้วย
    return json({ error: 'places_failed', status: response.status }, 502)
  }

  const data = (await response.json()) as { places?: GooglePlace[] }
  const places = (data.places ?? [])
    .filter((place) => typeof place.location?.latitude === 'number')
    .map((place) => ({
      id: place.id ?? '',
      name: place.displayName?.text ?? '',
      address: place.formattedAddress ?? '',
      lat: place.location!.latitude!,
      lng: place.location!.longitude!,
      category: place.primaryType ?? '',
    }))

  return json({ places })
}
