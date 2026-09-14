import { describe, expect, it } from 'vitest'
import { decodePolyline } from '../src/utils/polyline'

describe('decodePolyline', () => {
  /** ตัวอย่างมาตรฐานจากเอกสารของ Google */
  it('ถอดตัวอย่างมาตรฐานของ Google ได้ตรงทุกจุด', () => {
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    expect(points).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ])
  })

  /**
   * ตัวเข้ารหัสอ้างอิง เขียนไว้ในเทสต์เพื่อตรวจแบบไป-กลับ
   * แข็งแรงกว่าการฝังสตริงที่เตรียมไว้ล่วงหน้า เพราะครอบคลุมพิกัดจริงหลายจุด
   */
  function encode(points: { lat: number; lng: number }[]): string {
    let previousLat = 0
    let previousLng = 0
    let out = ''
    const chunk = (value: number) => {
      let v = value < 0 ? ~(value << 1) : value << 1
      while (v >= 0x20) {
        out += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
        v >>= 5
      }
      out += String.fromCharCode(v + 63)
    }
    for (const point of points) {
      const lat = Math.round(point.lat * 1e5)
      const lng = Math.round(point.lng * 1e5)
      chunk(lat - previousLat)
      chunk(lng - previousLng)
      previousLat = lat
      previousLng = lng
    }
    return out
  }

  it('ถอดพิกัดจริงในกรุงเทพได้ตรงถึงทศนิยมตำแหน่งที่ห้า', () => {
    // สยาม -> ราชประสงค์ -> ชิดลม เส้นทางเดินจริงที่คนตาบอดใช้บ่อย
    const original = [
      { lat: 13.7455, lng: 100.5341 },
      { lat: 13.7448, lng: 100.5401 },
      { lat: 13.7441, lng: 100.5452 },
    ]
    const decoded = decodePolyline(encode(original))
    expect(decoded.length).toBe(3)
    decoded.forEach((point, index) => {
      expect(point.lat).toBeCloseTo(original[index].lat, 5)
      expect(point.lng).toBeCloseTo(original[index].lng, 5)
    })
  })

  /*
   * เส้นทางเดินในเมืองมีจุดหักเลี้ยวถี่มาก ผลต่างระหว่างจุดจึงเล็กมาก
   * ต้องแน่ใจว่าค่าติดลบและค่าที่ใกล้ศูนย์ไม่เพี้ยน ไม่งั้นเส้นทางจะบิด
   */
  it('รักษาความถูกต้องของผลต่างที่เล็กและติดลบ', () => {
    const original = [
      { lat: 13.75, lng: 100.5 },
      { lat: 13.74999, lng: 100.50001 },
      { lat: 13.75002, lng: 100.49998 },
    ]
    const decoded = decodePolyline(encode(original))
    decoded.forEach((point, index) => {
      expect(point.lat).toBeCloseTo(original[index].lat, 5)
      expect(point.lng).toBeCloseTo(original[index].lng, 5)
    })
  })

  it('สตริงว่างคืนอาร์เรย์ว่าง ไม่ใช่โยน error', () => {
    expect(decodePolyline('')).toEqual([])
  })

  /*
   * เส้นทางที่ถอดออกมาเพี้ยนอันตรายกว่าการไม่มีเส้นทาง
   * เพราะระบบจะคำนวณว่าออกนอกเส้นทางผิด และพาผู้ใช้เลี้ยวผิดจังหวะ
   */
  it('สตริงที่พังคืนอาร์เรย์ว่าง ไม่คืนพิกัดที่เพี้ยน', () => {
    expect(decodePolyline('!!!!')).toEqual([])
    expect(decodePolyline('_p~iF~ps|U_ulLnnq')).toEqual([])
  })

  it('ไม่คืนพิกัดที่อยู่นอกโลก', () => {
    for (const point of decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')) {
      expect(Math.abs(point.lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(point.lng)).toBeLessThanOrEqual(180)
    }
  })
})
