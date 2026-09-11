import { describe, expect, it } from 'vitest'
import { projectOntoPath } from '@/utils/geometry'
import { simplifyPath } from '@/services/impl/overpassClient'
import type { LatLng } from '@/types'

/** เส้นทางตรงไปทางตะวันออกยาวประมาณ 220 เมตร */
const straightPath: LatLng[] = [
  { lat: 13.7467, lng: 100.5349 },
  { lat: 13.7467, lng: 100.536 },
  { lat: 13.7467, lng: 100.5369 },
]

describe('projectOntoPath', () => {
  it('วัดระยะห่างจากเส้นทางและระยะที่ต้องเดินไปถึงจุดนั้นได้', () => {
    // จุดที่อยู่บนเส้นทางพอดี ตรงกลางช่วงแรก
    const onPath = projectOntoPath({ lat: 13.7467, lng: 100.5355 }, straightPath)
    expect(onPath.distanceM).toBeLessThan(1)
    // ครึ่งหนึ่งของช่วงแรก (100.5349 -> 100.536 ประมาณ 119 เมตร)
    expect(onPath.alongM).toBeGreaterThan(50)
    expect(onPath.alongM).toBeLessThan(75)
  })

  it('จุดที่อยู่ข้างเส้นทางรายงานระยะห่างตามจริง', () => {
    // เยื้องไปทางเหนือประมาณ 0.0005 องศา = ราว 55 เมตร
    const offPath = projectOntoPath({ lat: 13.7472, lng: 100.5355 }, straightPath)
    expect(offPath.distanceM).toBeGreaterThan(45)
    expect(offPath.distanceM).toBeLessThan(70)
  })

  it('จุดที่เลยปลายเส้นทางไปแล้ว ไม่รายงานระยะเดินเกินความยาวเส้นทาง', () => {
    const beyond = projectOntoPath({ lat: 13.7467, lng: 100.545 }, straightPath)
    const totalLength = projectOntoPath(straightPath[2], straightPath).alongM
    expect(beyond.alongM).toBeLessThanOrEqual(totalLength + 1)
  })

  it('เส้นทางว่างไม่ทำให้พัง', () => {
    expect(projectOntoPath({ lat: 13.7, lng: 100.5 }, []).distanceM).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('simplifyPath', () => {
  it('ตัดจุดที่อยู่ชิดกันออก แต่คงจุดแรกและจุดสุดท้ายไว้เสมอ', () => {
    // 50 จุดเรียงชิดกันมาก (ห่างกันราว 1 เมตร)
    const dense: LatLng[] = Array.from({ length: 50 }, (_, i) => ({
      lat: 13.7467,
      lng: 100.5349 + i * 0.00001,
    }))
    const simplified = simplifyPath(dense, 40, 60)

    expect(simplified.length).toBeLessThan(dense.length)
    expect(simplified[0]).toEqual(dense[0])
    expect(simplified[simplified.length - 1]).toEqual(dense[dense.length - 1])
  })

  it('ไม่คืนจุดเกินจำนวนสูงสุดที่กำหนด', () => {
    const long: LatLng[] = Array.from({ length: 400 }, (_, i) => ({
      lat: 13.7467 + i * 0.001,
      lng: 100.5349,
    }))
    expect(simplifyPath(long, 10, 60)).toHaveLength(60)
  })

  it('เส้นทางว่างคืนอาเรย์ว่าง', () => {
    expect(simplifyPath([], 25, 60)).toEqual([])
  })
})
