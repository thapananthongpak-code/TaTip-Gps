import { OBSTACLE_CORRIDOR_M } from '@/services/config'
import type { ObstacleScanOptions, ObstacleService } from '@/services/interfaces'
import type { LatLng, Obstacle, ObstacleKind, ObstacleSeverity } from '@/types'
import { projectOntoPath } from '@/utils/geometry'
import {
  elementLocation,
  overpassQuery,
  simplifyPath,
  toAroundList,
  type OverpassElement,
} from './overpassClient'

/**
 * ประตู/แผงกั้นที่ "กีดขวางจริง" เท่านั้น
 *
 * OSM ใช้แท็ก barrier กับทั้งรั้วยาวๆ ข้างทาง (ซึ่งไม่ได้ขวางทางเดิน)
 * และเสาหรือประตูกลางทางเดิน (ซึ่งขวางจริง) ต้องคัดเอาเฉพาะอย่างหลัง
 * ไม่งั้นจะเตือนทุกสิบก้าวจนผู้ใช้ปิดฟีเจอร์ทิ้ง
 */
const BLOCKING_BARRIERS = new Set([
  'gate',
  'bollard',
  'block',
  'stile',
  'turnstile',
  'kissing_gate',
  'cycle_barrier',
  'lift_gate',
  'swing_gate',
  'chain',
  'log',
  'debris',
])

/** ทางที่แคบกว่านี้ (เมตร) ใช้ไม้เท้ากวาดหรือเข็นรถลำบาก */
const NARROW_WIDTH_M = 0.9

/** จำกัดจำนวนจุดที่ส่งให้ Overpass ไม่ให้ URL ยาวเกินและเซิร์ฟเวอร์ทำงานหนักเกินจำเป็น */
const MAX_PATH_POINTS = 60

/**
 * สิ่งกีดขวางชนิดเดียวกันที่ห่างกันไม่เกินนี้ (เมตร) ถือเป็นจุดเดียว
 *
 * จำเป็นเพราะ OSM แมปบันไดหนึ่งช่วงเป็นหลาย way ต่อกัน (แยกตามชานพัก ตามทิศ ตามราวจับ)
 * ทดสอบกับเส้นทางจริง 742 เมตรได้บันได 10 รายการ ทั้งที่จริงมีอยู่ 2-3 จุด
 * ถ้าไม่รวมกัน ผู้ใช้จะได้ยินคำว่า "บันได" ซ้ำติดกันหลายครั้งในไม่กี่ก้าว
 */
const MERGE_RADIUS_M = 30

function severityOf(kind: ObstacleKind): ObstacleSeverity {
  // บันไดกับเขตก่อสร้างทำให้บาดเจ็บได้ทันที ต้องเตือนด้วยเสียงระหว่างเดิน
  // ส่วนที่เหลือแค่ต้องระวัง รายงานก่อนออกเดินทางก็พอ
  return kind === 'steps' || kind === 'construction' ? 'high' : 'medium'
}

function classify(tags: Record<string, string>): ObstacleKind | null {
  if (tags.highway === 'steps') return 'steps'
  if (tags.highway === 'construction' || tags.construction) return 'construction'

  if (tags.barrier === 'kerb' || tags.kerb === 'raised') return 'kerb'
  if (tags.barrier && BLOCKING_BARRIERS.has(tags.barrier)) return 'barrier'

  if (tags.highway === 'crossing' && tags.tactile_paving === 'no') return 'crossing_no_tactile'

  const width = Number(tags.width)
  if (Number.isFinite(width) && width > 0 && width < NARROW_WIDTH_M) return 'narrow'

  return null
}

function toObstacle(
  element: OverpassElement,
  location: LatLng,
  kind: ObstacleKind,
  distanceFromStartM: number,
): Obstacle {
  const tags = element.tags ?? {}
  const stepCount = Number(tags.step_count)
  const width = Number(tags.width)

  return {
    id: `${element.type}/${element.id}`,
    kind,
    severity: severityOf(kind),
    location,
    distanceFromStartM,
    detail: {
      stepCount: Number.isFinite(stepCount) && stepCount > 0 ? stepCount : undefined,
      hasHandrail: tags.handrail ? tags.handrail !== 'no' : undefined,
      incline: tags.incline === 'up' || tags.incline === 'down' ? tags.incline : undefined,
      width: Number.isFinite(width) && width > 0 ? width : undefined,
      name: tags.name,
    },
  }
}

/**
 * ObstacleService บน Overpass API
 *
 * ⚠️ ตรวจได้เฉพาะสิ่งที่มีคนแมปไว้ในแผนที่ — ดูข้อจำกัดเต็มที่ interface
 * โดยเฉพาะในไทย มอเตอร์ไซค์จอดบนทางเท้าและแผงลอยคือสิ่งกีดขวางที่พบบ่อยที่สุด
 * และเป็นสิ่งที่ระบบนี้ตรวจไม่ได้เลย ผู้ใช้ต้องรู้ข้อนี้ก่อนใช้งาน
 */
export const overpassObstacleService: ObstacleService = {
  async scanRoute(geometry: LatLng[], options: ObstacleScanOptions = {}): Promise<Obstacle[]> {
    const { corridorM = OBSTACLE_CORRIDOR_M, signal } = options
    if (geometry.length === 0) return []

    // เว้นระยะจุดให้พอดีกับรัศมีที่ค้น วงที่ค้นรอบแต่ละจุดจะได้ต่อกันเป็นแนวยาวไม่ขาดตอน
    const points = simplifyPath(geometry, corridorM * 1.5, MAX_PATH_POINTS)
    const around = `around:${corridorM},${toAroundList(points)}`

    // node กับ way ต้องถามแยกกัน เพราะ way ต้องขอ center เพื่อให้ได้พิกัด
    const query = [
      '[out:json][timeout:25];',
      '(',
      `  node(${around})[barrier];`,
      `  node(${around})[highway=crossing][tactile_paving=no];`,
      `  way(${around})[highway=steps];`,
      `  way(${around})[highway=construction];`,
      `  way(${around})[construction];`,
      `  way(${around})[highway][width];`,
      ');',
      'out center tags 200;',
    ].join('\n')

    const elements = await overpassQuery(query, {
      signal,
      cacheKey: `obstacles|${corridorM}|${toAroundList(points)}`,
    })

    const obstacles = elements.flatMap((element): Obstacle[] => {
      const tags = element.tags
      if (!tags) return []
      const kind = classify(tags)
      if (!kind) return []

      const location = elementLocation(element)
      if (!location) return []

      // Overpass ค้นรอบ "จุดตัวอย่าง" ของเส้นทาง จึงอาจได้ของที่อยู่นอกทางเดินจริงติดมาด้วย
      // วัดระยะกับเส้นทางเต็มอีกครั้งเพื่อคัดออก และเพื่อรู้ว่าอยู่ช่วงไหนของทาง
      const projected = projectOntoPath(location, geometry)
      if (projected.distanceM > corridorM) return []

      return [toObstacle(element, location, kind, projected.alongM)]
    })

    // เรียงตามลำดับที่จะเดินไปเจอ เพื่อให้สรุปและคำเตือนเรียงตามเวลาจริง
    obstacles.sort((a, b) => a.distanceFromStartM - b.distanceFromStartM)

    // รวมของชนิดเดียวกันที่อยู่ติดกันให้เหลือจุดเดียว
    const merged: Obstacle[] = []
    for (const obstacle of obstacles) {
      const last = merged.findLast((kept) => kept.kind === obstacle.kind)
      if (last && obstacle.distanceFromStartM - last.distanceFromStartM < MERGE_RADIUS_M) continue
      merged.push(obstacle)
    }

    return merged
  },
}
