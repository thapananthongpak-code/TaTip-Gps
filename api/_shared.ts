/**
 * ตัวช่วยที่ใช้ร่วมกันของทุก endpoint ฝั่งเซิร์ฟเวอร์
 *
 * เหตุผลที่ต้องมี proxy แทนที่จะยิง Google ตรงจากแอป:
 * คีย์ของ Places/Routes/Geocoding จำกัดด้วย referrer ไม่ได้อย่างที่ Maps JS ทำได้
 * ถ้าฝังไว้ในแอปที่แจกเป็นไฟล์ APK ใครก็แกะออกมาใช้จนบิลบานได้
 */

/** ชื่อ header ที่ใช้ส่งโทเค็นร่วม */
export const TOKEN_HEADER = 'x-taathip-token'

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // ผลลัพธ์ผูกกับพิกัดของผู้ใช้ ห้ามให้ CDN เก็บไว้แจกให้คนอื่น
      'Cache-Control': 'no-store',
    },
  })
}

export function badRequest(message: string): Response {
  return json({ error: message }, 400)
}

/**
 * ตรวจโทเค็นร่วม ถ้าตั้งค่าไว้ฝั่งเซิร์ฟเวอร์
 *
 * ⚠️ กันได้แค่การถูกยิงมั่วจากคนที่บังเอิญเจอ URL เท่านั้น
 * ไม่ใช่การยืนยันตัวตนจริง เพราะโทเค็นอยู่ในตัวแอปที่แจกออกไป ใครแกะก็เห็น
 * การป้องกันที่ได้ผลจริงคือการตั้งวงเงินและแจ้งเตือนงบใน Cloud Console
 */
export function unauthorized(request: Request): Response | null {
  const expected = process.env.API_TOKEN
  if (!expected) return null
  return request.headers.get(TOKEN_HEADER) === expected ? null : json({ error: 'forbidden' }, 403)
}

/** คีย์ฝั่งเซิร์ฟเวอร์ — ต่างจากคีย์ของ Maps JS และต้องไม่เคยออกไปถึงเบราว์เซอร์ */
export function serverKey(): string | null {
  return process.env.GOOGLE_MAPS_SERVER_KEY || null
}

/** อ่านพิกัดจาก query string พร้อมตรวจช่วงค่า ไม่ใช่แค่แปลงเป็นตัวเลข */
export function readLatLng(
  params: URLSearchParams,
  latKey = 'lat',
  lngKey = 'lng',
): { lat: number; lng: number } | null {
  const lat = Number(params.get(latKey))
  const lng = Number(params.get(lngKey))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

/** ภาษาที่ยอมรับ — จำกัดไว้เท่าที่แอปรองรับจริง ไม่ส่งค่าที่ผู้ใช้พิมพ์มาตรงๆ ต่อให้ Google */
export function readLanguage(params: URLSearchParams): 'th' | 'en' {
  return params.get('lang') === 'en' ? 'en' : 'th'
}
