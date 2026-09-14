import { badRequest, json, readLanguage, readLatLng, serverKey, unauthorized } from './_shared'

export const config = { runtime: 'edge' }

interface RouteStep {
  distanceMeters?: number
  staticDuration?: string
  polyline?: { encodedPolyline?: string }
  startLocation?: { latLng?: { latitude?: number; longitude?: number } }
  endLocation?: { latLng?: { latitude?: number; longitude?: number } }
  navigationInstruction?: { maneuver?: string; instructions?: string }
}

/**
 * เส้นทางเดินเท้าผ่าน Routes API
 *
 * ⚠️ travelMode ต้องเป็น WALK เสมอ ห้ามถอยไปใช้ DRIVE เมื่อหาเส้นทางเดินไม่ได้
 * เส้นทางรถพาไปตามถนนที่ไม่มีทางเท้าและคิดเวลาด้วยความเร็วรถ
 * สำหรับผู้ใช้ที่มองไม่เห็น นั่นคือการพาไปเดินบนถนนที่รถวิ่ง
 */
export default async function handler(request: Request): Promise<Response> {
  const blocked = unauthorized(request)
  if (blocked) return blocked

  const key = serverKey()
  if (!key) return json({ error: 'GOOGLE_MAPS_SERVER_KEY is not configured' }, 503)

  const { searchParams } = new URL(request.url)
  const origin = readLatLng(searchParams, 'fromLat', 'fromLng')
  const destination = readLatLng(searchParams, 'toLat', 'toLng')
  if (!origin || !destination) return badRequest('fromLat/fromLng and toLat/toLng are required')

  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': [
        'routes.distanceMeters',
        'routes.duration',
        'routes.polyline.encodedPolyline',
        'routes.legs.steps.distanceMeters',
        'routes.legs.steps.staticDuration',
        'routes.legs.steps.polyline.encodedPolyline',
        'routes.legs.steps.startLocation',
        'routes.legs.steps.endLocation',
        'routes.legs.steps.navigationInstruction',
      ].join(','),
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: {
        location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
      },
      travelMode: 'WALK',
      languageCode: readLanguage(searchParams),
      units: 'METRIC',
      // ขอทางเลือกเดียว ผู้ใช้ที่ฟังอย่างเดียวเลือกจากหลายเส้นทางไม่ไหวอยู่แล้ว
      computeAlternativeRoutes: false,
    }),
  })

  if (!response.ok) return json({ error: 'routes_failed', status: response.status }, 502)

  const data = (await response.json()) as {
    routes?: {
      distanceMeters?: number
      duration?: string
      polyline?: { encodedPolyline?: string }
      legs?: { steps?: RouteStep[] }[]
    }[]
  }

  const route = data.routes?.[0]
  if (!route) return json({ route: null })

  const steps = (route.legs ?? []).flatMap((leg) => leg.steps ?? [])
  return json({
    route: {
      distanceMeters: route.distanceMeters ?? 0,
      // Routes API คืนเวลาเป็นสตริงลงท้ายด้วย s เช่น "432s"
      durationSeconds: Number((route.duration ?? '0s').replace('s', '')) || 0,
      polyline: route.polyline?.encodedPolyline ?? '',
      steps: steps.map((step) => ({
        distanceMeters: step.distanceMeters ?? 0,
        durationSeconds: Number((step.staticDuration ?? '0s').replace('s', '')) || 0,
        polyline: step.polyline?.encodedPolyline ?? '',
        startLat: step.startLocation?.latLng?.latitude ?? 0,
        startLng: step.startLocation?.latLng?.longitude ?? 0,
        endLat: step.endLocation?.latLng?.latitude ?? 0,
        endLng: step.endLocation?.latLng?.longitude ?? 0,
        maneuver: step.navigationInstruction?.maneuver ?? '',
        instruction: step.navigationInstruction?.instructions ?? '',
      })),
    },
  })
}
