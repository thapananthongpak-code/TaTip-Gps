import { describe, expect, it } from 'vitest'
import {
  classifyMovement,
  movementFrom,
  netSpeed,
  stationaryDuration,
  STATIONARY_SPEED_MPS,
  VEHICLE_SPEED_MPS,
  walkingPace,
  withinWindow,
} from '../src/utils/movement'
import type { GeoPosition } from '../src/types'

const BASE = { lat: 13.7455, lng: 100.5341 }
/** สร้างตำแหน่งที่ห่างจากจุดตั้งต้นไปทางตะวันออก m เมตร ณ วินาทีที่ t */
const at = (m: number, t: number, accuracy = 5): GeoPosition => ({
  lat: BASE.lat,
  lng: BASE.lng + m * 0.00000922,
  accuracy,
  heading: null,
  speed: null,
  timestamp: 100000 + t * 1000,
})

describe('netSpeed', () => {
  it('คำนวณความเร็วคนเดินได้ตรง', () => {
    // เดิน 60 เมตรใน 60 วินาที = 1 เมตร/วินาที
    const speed = netSpeed([at(0, 0), at(30, 30), at(60, 60)])
    expect(speed).toBeCloseTo(1.0, 1)
  })

  it('คำนวณความเร็วรถได้ตรง', () => {
    // 600 เมตรใน 60 วินาที = 10 เมตร/วินาที (36 กม./ชม.)
    expect(netSpeed([at(0, 0), at(600, 60)])).toBeCloseTo(10, 0)
  })

  /*
   * ข้อมูลน้อยเกินไปต้องคืน null ไม่ใช่เดาค่า
   * การเดาความเร็วจากข้อมูลสองจุดที่ห่างกันไม่กี่วินาที
   * จะทำให้ GPS กระโดดครั้งเดียวกลายเป็น "กำลังนั่งรถ" ทันที
   */
  it('ช่วงเวลาสั้นเกินไปคืน null', () => {
    expect(netSpeed([at(0, 0), at(20, 5)])).toBeNull()
    expect(netSpeed([at(0, 0)])).toBeNull()
    expect(netSpeed([])).toBeNull()
  })

  /*
   * หัวใจของการจำแนกที่ถูกต้อง
   * ถ้าบวกระยะทุกช่วงย่อย GPS ที่แกว่งอยู่กับที่จะสร้างระยะทางปลอมขึ้นเรื่อยๆ
   * คนที่ยืนนิ่งรอข้ามถนนจะถูกมองว่ากำลังเดิน แล้วเวลาที่เหลือก็ผิดตามไปด้วย
   */
  it('ยืนนิ่งแต่ GPS แกว่ง ต้องได้ความเร็วเป็นศูนย์', () => {
    const jitter: GeoPosition[] = [
      { ...at(0, 0, 15) },
      { ...at(8, 20, 15) },
      { ...at(-6, 40, 15) },
      { ...at(5, 60, 15) },
    ]
    expect(netSpeed(jitter)).toBe(0)
  })

  it('ระยะที่เล็กกว่าความคลาดเคลื่อนของ GPS ถือเป็นศูนย์', () => {
    expect(netSpeed([at(0, 0, 20), at(12, 60, 20)])).toBe(0)
  })
})

describe('classifyMovement', () => {
  it.each([
    [null, 'unknown'],
    [0, 'stationary'],
    [STATIONARY_SPEED_MPS, 'stationary'],
    [1.0, 'walking'],
    [2.5, 'walking'],
    [VEHICLE_SPEED_MPS, 'vehicle'],
    [12, 'vehicle'],
  ])('ความเร็ว %s -> %s', (speed, expected) => {
    expect(classifyMovement(speed)).toBe(expected)
  })

  /** คนเดินเร็วที่สุดต้องไม่ถูกมองว่านั่งรถ ไม่งั้นจะโดนหยุดนำทางทั้งที่เดินอยู่ */
  it('คนเดินเร็วยังถือว่าเดิน', () => {
    expect(classifyMovement(2.2)).toBe('walking')
  })
})

describe('withinWindow', () => {
  it('ตัดตัวอย่างที่เก่าเกินหน้าต่างเวลาออก', () => {
    const samples = [at(0, 0), at(10, 30), at(20, 60), at(30, 90)]
    const kept = withinWindow(samples, 40_000)
    expect(kept.length).toBeLessThan(samples.length)
    expect(kept.at(-1)).toBe(samples.at(-1))
  })

  /** ต้องเหลือจุดก่อนหน้าต่างไว้หนึ่งจุด ไม่งั้นวัดช่วงเวลาไม่ครบ */
  it('เก็บจุดสุดท้ายก่อนหน้าต่างไว้เสมอ', () => {
    const samples = [at(0, 0), at(10, 30), at(20, 60)]
    const kept = withinWindow(samples, 20_000)
    expect(kept[0].timestamp).toBeLessThan(samples.at(-1)!.timestamp - 20_000 + 1)
  })

  it('ข้อมูลว่างไม่พัง', () => {
    expect(withinWindow([], 30_000)).toEqual([])
  })
})

describe('walkingPace — ความเร็วเดินจริงของผู้ใช้', () => {
  /*
   * ETA เดิมใช้ความเร็วสมมติของ OSRM ที่ราว 1.25 เมตร/วินาที
   * คนที่ใช้ไม้เท้าตรวจทางทุกก้าวเดินราว 0.6-0.9 เท่านั้น
   * เวลาที่บอกจึงสั้นกว่าความจริงเกือบเท่าตัว และยิ่งเส้นทางยาวยิ่งคลาดมาก
   */
  it('วัดความเร็วคนเดินช้าได้ตรง', () => {
    // เดิน 0.7 เมตร/วินาที เป็นเวลา 60 วินาที
    const slow = Array.from({ length: 13 }, (_, i) => at(i * 3.5, i * 5))
    expect(walkingPace(slow)).toBeCloseTo(0.7, 1)
  })

  /*
   * หัวใจของการคำนวณเวลาให้แม่น
   * ถ้านับช่วงที่หยุดรอไฟแดงเข้าไปในค่าเฉลี่ยด้วย ระบบจะคิดว่าผู้ใช้เดินช้ามาก
   * แล้วบอกเวลาที่เหลือยาวเกินจริงไปมาก จนผู้ใช้วางแผนผิด
   */
  it('ไม่นับช่วงที่หยุดรอเข้าไปในค่าเฉลี่ย', () => {
    const walk = Array.from({ length: 9 }, (_, i) => at(i * 5, i * 5)) // 1.0 m/s 40 วินาที
    const wait = Array.from({ length: 12 }, (_, i) => at(40, 40 + (i + 1) * 5)) // ยืนรอ 60 วินาที
    const pace = walkingPace([...walk, ...wait])
    expect(pace).toBeCloseTo(1.0, 1)
  })

  it('ไม่นับช่วงที่อยู่บนยานพาหนะ', () => {
    const walk = Array.from({ length: 9 }, (_, i) => at(i * 5, i * 5)) // 1.0 m/s
    const ride = Array.from({ length: 7 }, (_, i) => at(40 + (i + 1) * 60, 40 + (i + 1) * 5)) // 12 m/s
    expect(walkingPace([...walk, ...ride])).toBeCloseTo(1.0, 1)
  })

  it('เดินยังไม่นานพอ คืน null ไม่เดาค่า', () => {
    expect(walkingPace([at(0, 0), at(10, 10)])).toBeNull()
    expect(walkingPace([])).toBeNull()
  })
})

describe('stationaryDuration', () => {
  it('นับเวลาที่หยุดนิ่งต่อเนื่องล่าสุด', () => {
    const walk = Array.from({ length: 5 }, (_, i) => at(i * 10, i * 10))
    const stop = Array.from({ length: 7 }, (_, i) => at(40, 40 + (i + 1) * 10))
    expect(stationaryDuration([...walk, ...stop])).toBeGreaterThanOrEqual(60_000)
  })

  it('กำลังเดินอยู่ = ไม่ได้หยุด', () => {
    expect(stationaryDuration(Array.from({ length: 8 }, (_, i) => at(i * 10, i * 10)))).toBe(0)
  })
})

describe('movementFrom — สรุปรวม', () => {
  it('เดินปกติ', () => {
    const m = movementFrom(Array.from({ length: 13 }, (_, i) => at(i * 5, i * 5)))
    expect(m.mode).toBe('walking')
    expect(m.paceMps).toBeCloseTo(1.0, 1)
    expect(m.stationaryMs).toBe(0)
  })

  it('อยู่บนยานพาหนะ', () => {
    const m = movementFrom(Array.from({ length: 13 }, (_, i) => at(i * 60, i * 5)))
    expect(m.mode).toBe('vehicle')
  })

  it('ยืนนิ่ง', () => {
    const m = movementFrom(Array.from({ length: 13 }, (_, i) => at(0, i * 5, 15)))
    expect(m.mode).toBe('stationary')
    expect(m.stationaryMs).toBeGreaterThan(0)
  })

  it('ข้อมูลว่างไม่พังและไม่เดาอะไร', () => {
    const m = movementFrom([])
    expect(m.mode).toBe('unknown')
    expect(m.speedMps).toBeNull()
    expect(m.paceMps).toBeNull()
  })
})

describe('รถในเมืองที่วิ่งสลับจอด', () => {
  /** สร้างข้อมูลการเดินทางจากช่วงความเร็วที่กำหนด */
  function ride(phases: { seconds: number; mps: number }[]) {
    const samples: GeoPosition[] = [at(0, 0)]
    let distance = 0
    let time = 0
    for (const phase of phases) {
      for (let i = 0; i < phase.seconds; i += 5) {
        distance += phase.mps * 5
        time += 5
        samples.push(at(distance, time, 10))
      }
    }
    return samples
  }

  /** นับจำนวนครั้งที่สถานะ "อยู่บนยานพาหนะ" พลิกไปมาตลอดการเดินทาง */
  function vehicleFlips(samples: GeoPosition[]) {
    let previous: boolean | null = null
    let flips = 0
    for (let i = 2; i < samples.length; i++) {
      const inVehicle = movementFrom(samples.slice(0, i + 1)).mode === 'vehicle'
      if (previous !== null && inVehicle !== previous) flips++
      previous = inVehicle
    }
    return flips
  }

  /*
   * ทุกครั้งที่สถานะพลิก แอปจะพูด "พักคำแนะนำ" หรือ "พร้อมอีกครั้ง" ออกมา
   * นอกจากจะเป็นเสียงรบกวนแล้ว ช่วงที่บอกว่าพร้อมมันจะกลับไปสั่งเดิน
   * ให้คนที่ยังนั่งอยู่บนรถ ซึ่งถ้าทำตามคือก้าวลงจากรถที่กำลังวิ่ง
   */
  it('จอดติดไฟแดงนานๆ ต้องไม่ถูกมองว่าลงจากรถแล้ว', () => {
    const samples = ride([
      { seconds: 40, mps: 10 },
      { seconds: 70, mps: 0 },
      { seconds: 40, mps: 10 },
      { seconds: 70, mps: 0 },
    ])
    expect(vehicleFlips(samples)).toBe(1)
    expect(movementFrom(samples).mode).toBe('vehicle')
  })

  /** เดินอย่างเดียวต้องไม่เข้าโหมดรถเลยแม้แต่ครั้งเดียว */
  it('เดินปกติไม่เข้าโหมดรถ', () => {
    const samples = ride([
      { seconds: 60, mps: 1.0 },
      { seconds: 40, mps: 0 },
      { seconds: 60, mps: 1.2 },
    ])
    expect(vehicleFlips(samples)).toBe(0)
  })

  /** ลงจากรถแล้วเดินต่อ ต้องกลับมาให้คำแนะนำได้ในที่สุด */
  it('ลงจากรถแล้วเดินต่อ ในที่สุดต้องออกจากโหมดรถ', () => {
    const samples = ride([
      { seconds: 60, mps: 10 },
      { seconds: 180, mps: 1.0 },
    ])
    expect(movementFrom(samples).mode).toBe('walking')
  })
})
