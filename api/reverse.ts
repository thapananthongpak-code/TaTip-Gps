import { badRequest, json, readLanguage, readLatLng, serverKey, unauthorized } from './_shared'

export const config = { runtime: 'edge' }

interface GeocodeResult {
  place_id?: string
  formatted_address?: string
  address_components?: { long_name?: string; types?: string[] }[]
}

/**
 * แปลงพิกัดเป็นที่อยู่ สำหรับปุ่ม "ฉันอยู่ที่ไหน"
 *
 * ปุ่มนี้สำคัญกว่าที่ชื่อบอก เพราะเป็นวิธีเดียวที่ผู้ใช้ตรวจสอบได้ว่า
 * ตำแหน่งที่ระบบคิดว่าเขาอยู่ ตรงกับที่เขาอยู่จริงหรือไม่
 */
export default async function handler(request: Request): Promise<Response> {
  const blocked = unauthorized(request)
  if (blocked) return blocked

  const key = serverKey()
  if (!key) return json({ error: 'GOOGLE_MAPS_SERVER_KEY is not configured' }, 503)

  const { searchParams } = new URL(request.url)
  const at = readLatLng(searchParams)
  if (!at) return badRequest('lat and lng are required')

  const params = new URLSearchParams({
    latlng: `${at.lat},${at.lng}`,
    language: readLanguage(searchParams),
    key,
  })

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`)
  if (!response.ok) return json({ error: 'geocode_failed', status: response.status }, 502)

  const data = (await response.json()) as { status?: string; results?: GeocodeResult[] }
  const first = data.results?.[0]
  if (!first) return json({ place: null })

  /*
   * ชื่อสั้นสำหรับพูด ไม่ใช่ที่อยู่เต็ม
   * ที่อยู่เต็มของ Google ยาวมากและลงท้ายด้วยรหัสไปรษณีย์กับชื่อประเทศ
   * ซึ่งเมื่ออ่านออกเสียงจะกินเวลาหลายวินาทีโดยไม่ช่วยให้รู้ว่าอยู่ตรงไหน
   */
  const named = first.address_components?.find((part) =>
    part.types?.some((type) => type === 'route' || type === 'premise'),
  )

  return json({
    place: {
      id: first.place_id ?? '',
      name: named?.long_name ?? first.formatted_address ?? '',
      address: first.formatted_address ?? '',
      lat: at.lat,
      lng: at.lng,
    },
  })
}
