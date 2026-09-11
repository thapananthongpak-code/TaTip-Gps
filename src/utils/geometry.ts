import type { LatLng } from '@/types'

const EARTH_RADIUS_M = 6_371_008.8
const toRad = (deg: number) => (deg * Math.PI) / 180

/**
 * ฉายพิกัดลงระนาบเมตรรอบจุดอ้างอิง (equirectangular)
 * ในระยะไม่กี่ร้อยเมตรความคลาดเคลื่อนต่ำมาก และเร็วกว่าการคำนวณบนทรงกลมมาก
 * ซึ่งสำคัญเพราะฟังก์ชันนี้ถูกเรียกทุกครั้งที่ GPS อัปเดต
 */
function project(point: LatLng, origin: LatLng): { x: number; y: number } {
  const x = toRad(point.lng - origin.lng) * Math.cos(toRad(origin.lat)) * EARTH_RADIUS_M
  const y = toRad(point.lat - origin.lat) * EARTH_RADIUS_M
  return { x, y }
}

/** ระยะจากจุดถึงเส้นตรงหนึ่งช่วง (เมตร) */
export function distanceToSegment(point: LatLng, a: LatLng, b: LatLng): number {
  const p = project(point, point)
  const pa = project(a, point)
  const pb = project(b, point)

  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const lengthSq = dx * dx + dy * dy

  if (lengthSq === 0) return Math.hypot(p.x - pa.x, p.y - pa.y)

  // หาตำแหน่งที่ใกล้ที่สุดบนช่วงเส้น แล้วบีบให้อยู่ในช่วง [0,1] ไม่ให้เลยปลายเส้น
  const t = Math.max(0, Math.min(1, ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / lengthSq))
  return Math.hypot(p.x - (pa.x + t * dx), p.y - (pa.y + t * dy))
}

/**
 * ระยะจากจุดถึงเส้นทาง (เมตร) — ใช้ตรวจว่าผู้ใช้ออกนอกเส้นทางหรือยัง
 * คืน Infinity ถ้าเส้นทางว่าง เพื่อให้ชั้นบนตัดสินใจได้เองว่าจะทำอย่างไร
 */
export function distanceToPath(point: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY
  if (path.length === 1) return distanceToSegment(point, path[0], path[0])

  let min = Number.POSITIVE_INFINITY
  for (let i = 0; i < path.length - 1; i++) {
    const d = distanceToSegment(point, path[i], path[i + 1])
    if (d < min) min = d
  }
  return min
}

/** Distance along the remaining polyline, not a shortcut through buildings. */
export function remainingPathDistance(point: LatLng, path: LatLng[]): number {
  if (path.length < 2) return path.length ? distanceToPath(point, path) : Infinity
  let nearest = Infinity
  let remaining = 0
  let tail = 0
  for (let i = path.length - 2; i >= 0; i--) {
    const a = project(path[i], point)
    const b = project(path[i + 1], point)
    const dx = b.x - a.x,
      dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    const t = length ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (length * length))) : 0
    const offset = Math.hypot(a.x + t * dx, a.y + t * dy)
    if (offset < nearest) {
      nearest = offset
      remaining = (1 - t) * length + tail
    }
    tail += length
  }
  return remaining
}

/**
 * หาว่าจุดหนึ่งอยู่ตรงไหนของเส้นทาง
 *
 * คืนทั้งระยะห่างจากเส้นทาง (ใช้คัดว่าเกี่ยวข้องไหม)
 * และระยะที่ต้องเดินจากจุดเริ่มต้นไปถึงตรงนั้น (ใช้เรียงลำดับและบอกว่า "อีกกี่เมตรจะถึง")
 */
export function projectOntoPath(
  point: LatLng,
  path: LatLng[],
): { distanceM: number; alongM: number } {
  if (path.length === 0) return { distanceM: Number.POSITIVE_INFINITY, alongM: 0 }
  if (path.length === 1) return { distanceM: distanceToSegment(point, path[0], path[0]), alongM: 0 }

  let best = { distanceM: Number.POSITIVE_INFINITY, alongM: 0 }
  let travelled = 0

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const segmentLength = segmentLengthM(a, b)
    const distance = distanceToSegment(point, a, b)

    if (distance < best.distanceM) {
      best = { distanceM: distance, alongM: travelled + fractionAlong(point, a, b) * segmentLength }
    }
    travelled += segmentLength
  }

  return best
}

/** ความยาวของช่วงเส้นหนึ่ง (เมตร) */
function segmentLengthM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat) * EARTH_RADIUS_M
  const dLng = toRad(b.lng - a.lng) * Math.cos(toRad(a.lat)) * EARTH_RADIUS_M
  return Math.hypot(dLat, dLng)
}

/** จุดที่ใกล้ที่สุดบนช่วงเส้น อยู่ที่สัดส่วนเท่าไรของช่วงนั้น (0-1) */
function fractionAlong(point: LatLng, a: LatLng, b: LatLng): number {
  const scale = Math.cos(toRad(point.lat))
  const ax = (a.lng - point.lng) * scale
  const ay = a.lat - point.lat
  const bx = (b.lng - point.lng) * scale
  const by = b.lat - point.lat
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return 0
  return Math.max(0, Math.min(1, (-ax * dx - ay * dy) / lengthSq))
}
