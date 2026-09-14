import { mapService } from '@/services'
import type { GeoPosition } from '@/types'

/**
 * เร็วกว่านี้ (เมตร/วินาที) ถือว่าไม่ใช่การเดิน
 *
 * คนเดินเร็วอยู่ที่ราว 1.5-2 เมตร/วินาที คนตาบอดที่ใช้ไม้เท้าตรวจทางช้ากว่านั้นมาก
 * ตั้งไว้ 3.0 (ราว 11 กม./ชม.) จึงห่างจากการเดินเร็วที่สุดพอสมควร
 * และยังต่ำกว่าความเร็วรถในเมืองที่ติดไฟแดงบ่อยๆ
 */
export const VEHICLE_SPEED_MPS = 3.0

/** ช้ากว่านี้ถือว่าอยู่กับที่ ไม่ได้กำลังเดินไปไหน */
export const STATIONARY_SPEED_MPS = 0.2

/** ต้องมีข้อมูลครอบคลุมช่วงเวลาอย่างน้อยเท่านี้ถึงจะเชื่อค่าความเร็ว */
export const MIN_WINDOW_MS = 20_000

export type MovementMode = 'unknown' | 'stationary' | 'walking' | 'vehicle'

/**
 * ความเร็วสุทธิจากตำแหน่งแรกถึงตำแหน่งล่าสุดในหน้าต่างเวลา
 *
 * ใช้ระยะจากจุดแรกถึงจุดสุดท้ายโดยตรง ไม่ใช่ผลรวมของทุกช่วงย่อย
 * เพราะ GPS ที่แกว่งอยู่กับที่จะสร้างระยะทางปลอมขึ้นมาเรื่อยๆ ถ้าบวกทุกช่วง
 * คนที่ยืนนิ่งจึงจะถูกมองว่ากำลังเดินด้วยความเร็วหนึ่ง ซึ่งผิดทั้งการจำแนก
 * และทำให้เวลาที่เหลือคำนวณผิดตามไปด้วย
 *
 * คืน null เมื่อข้อมูลยังไม่พอหรือไม่น่าเชื่อถือ ไม่เดาค่าให้
 */
export function netSpeed(samples: GeoPosition[]): number | null {
  if (samples.length < 2) return null

  const first = samples[0]
  const last = samples[samples.length - 1]
  const elapsedMs = last.timestamp - first.timestamp
  if (elapsedMs < MIN_WINDOW_MS) return null

  const distance = mapService.distanceBetween(first, last)

  /*
   * ระยะที่เล็กกว่าความคลาดเคลื่อนของ GPS แยกไม่ออกจากการยืนนิ่ง
   * ถือเป็นศูนย์ไปเลย ดีกว่ารายงานความเร็วที่มาจากความคลาดเคลื่อนล้วนๆ
   */
  const noiseFloor = Math.max(first.accuracy, last.accuracy)
  if (distance < noiseFloor) return 0

  return distance / (elapsedMs / 1000)
}

/** จำแนกว่ากำลังทำอะไรอยู่จากความเร็วที่วัดได้ */
export function classifyMovement(speedMps: number | null): MovementMode {
  if (speedMps === null) return 'unknown'
  if (speedMps >= VEHICLE_SPEED_MPS) return 'vehicle'
  if (speedMps <= STATIONARY_SPEED_MPS) return 'stationary'
  return 'walking'
}

/**
 * ตัดตัวอย่างที่เก่ากว่าหน้าต่างเวลาที่สนใจออก
 * เก็บตัวสุดท้ายก่อนหน้าต่างไว้หนึ่งตัวเสมอ เพื่อให้ยังวัดช่วงเวลาได้ครบ
 */
export function withinWindow(samples: GeoPosition[], windowMs: number): GeoPosition[] {
  if (samples.length === 0) return samples
  const newest = samples[samples.length - 1].timestamp
  const cutoff = newest - windowMs
  const firstInside = samples.findIndex((s) => s.timestamp >= cutoff)
  return firstInside <= 0 ? samples : samples.slice(firstInside - 1)
}

/** ช่วงเวลาที่ใช้ตัดสินว่ากำลังทำอะไรอยู่ ณ ตอนนี้ */
export const MODE_WINDOW_MS = 60_000

/** ต้องเดินจริงรวมกันอย่างน้อยเท่านี้ถึงจะเชื่อค่าความเร็วเดินเฉลี่ย */
const MIN_WALKING_MS = 30_000

export interface Movement {
  speedMps: number | null
  mode: MovementMode
  /**
   * ความเร็วเดินเฉลี่ยของผู้ใช้คนนี้ — null จนกว่าจะเดินจริงนานพอ
   *
   * นับเฉพาะช่วงที่กำลังเดินจริง ไม่รวมตอนหยุดรอและตอนอยู่บนยานพาหนะ
   * ถ้าเฉลี่ยรวมตอนหยุดเข้าไปด้วย ค่าจะต่ำจนเวลาที่เหลือเพี้ยนไปคนละเรื่อง
   */
  paceMps: number | null
  /** หยุดนิ่งต่อเนื่องมากี่มิลลิวินาที (0 = ไม่ได้หยุด) */
  stationaryMs: number
}

/** ความเร็วของแต่ละช่วงย่อยระหว่างสองตำแหน่งที่ติดกัน */
function segments(samples: GeoPosition[]) {
  const out: { distance: number; ms: number; speed: number }[] = []
  for (let i = 1; i < samples.length; i++) {
    const ms = samples[i].timestamp - samples[i - 1].timestamp
    if (ms <= 0) continue
    const distance = mapService.distanceBetween(samples[i - 1], samples[i])
    out.push({ distance, ms, speed: distance / (ms / 1000) })
  }
  return out
}

/**
 * ความเร็วเดินเฉลี่ยจากช่วงที่กำลังเดินจริงเท่านั้น
 *
 * แยกช่วงที่หยุดออกก่อนหาค่าเฉลี่ย ไม่งั้นการหยุดรอไฟแดงนานๆ
 * จะทำให้ระบบคิดว่าผู้ใช้เดินช้ามาก แล้วบอกเวลาที่เหลือยาวเกินจริงไปมาก
 */
export function walkingPace(samples: GeoPosition[]): number | null {
  let distance = 0
  let ms = 0
  for (const seg of segments(samples)) {
    if (seg.speed <= STATIONARY_SPEED_MPS || seg.speed >= VEHICLE_SPEED_MPS) continue
    distance += seg.distance
    ms += seg.ms
  }
  if (ms < MIN_WALKING_MS || distance <= 0) return null
  return distance / (ms / 1000)
}

/** หยุดนิ่งต่อเนื่องมานานเท่าไร นับย้อนจากตำแหน่งล่าสุด */
export function stationaryDuration(samples: GeoPosition[]): number {
  const parts = segments(samples)
  let ms = 0
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].speed > STATIONARY_SPEED_MPS) break
    ms += parts[i].ms
  }
  return ms
}

/**
 * สรุปสถานะการเคลื่อนที่จากประวัติตำแหน่ง — ฟังก์ชันบริสุทธิ์ล้วน
 *
 * ไม่เก็บสถานะของตัวเองเลย ทุกอย่างคำนวณใหม่จากประวัติที่ได้รับ
 * จึงทดสอบได้ตรงไปตรงมาและไม่มีปัญหาเรื่องลำดับการ render
 */
export function movementFrom(samples: GeoPosition[]): Movement {
  const recent = withinWindow(samples, MODE_WINDOW_MS)
  const speedMps = netSpeed(recent)
  const mode = classifyMovement(speedMps)
  return {
    speedMps,
    mode,
    paceMps: walkingPace(samples),
    stationaryMs: mode === 'stationary' ? stationaryDuration(samples) : 0,
  }
}
