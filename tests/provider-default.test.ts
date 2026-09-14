import { describe, expect, it } from 'vitest'
import { geocodingService, routingService, USE_GOOGLE } from '../src/services'
import { compositeGeocodingService } from '../src/services/impl/compositeGeocodingService'
import { googleGeocodingService } from '../src/services/impl/googleGeocodingService'
import { googleRoutingService } from '../src/services/impl/googleRoutingService'
import { osrmRoutingService } from '../src/services/impl/osrmRoutingService'

const configuredKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? ''

describe('การเลือกผู้ให้บริการ', () => {
  /**
   * ไม่ได้ตั้งคีย์ = ต้องใช้ชุดฟรีที่ไม่ต้องผูกบัตรเครดิต
   *
   * Google Maps Platform บังคับผูกบัตรก่อนจึงจะเปิด API ได้ แม้จะมีโควตาฟรีให้
   * โปรเจกต์นี้จึงต้องเดินได้เต็มรูปแบบโดยไม่ต้องมีคีย์ ไม่ใช่แค่ "เปิดได้แต่ใช้ไม่ได้"
   * ใน CI ไม่มีไฟล์ .env อยู่แล้ว เงื่อนไขนี้จึงถูกตรวจทุกครั้งที่รันอัตโนมัติ
   */
  it('ไม่ได้ตั้งคีย์ = ไม่ใช้ Google', () => {
    if (configuredKey) {
      // เครื่องที่ตั้งคีย์ไว้แปลว่าตั้งใจจะใช้ Google — ไม่ใช่ความผิดพลาด
      expect(USE_GOOGLE).toBe(true)
      return
    }
    expect(USE_GOOGLE).toBe(false)
  })

  /*
   * ตรวจว่า "ทั้งชุดไปด้วยกัน" ไม่ใช่ครึ่งๆ กลางๆ
   *
   * ข้อกำหนดของ Google ห้ามเอาข้อมูล Places/Routes ไปแสดงบนแผนที่ที่ไม่ใช่ Google Maps
   * สถานะที่ค้นหาด้วย Google แต่หาเส้นทางด้วย OSRM จึงต้องเกิดขึ้นไม่ได้เลย
   */
  it('ค้นหาและเส้นทางต้องมาจากเจ้าเดียวกันเสมอ', () => {
    if (USE_GOOGLE) {
      expect(geocodingService).toBe(googleGeocodingService)
      expect(routingService).toBe(googleRoutingService)
    } else {
      expect(geocodingService).toBe(compositeGeocodingService)
      expect(routingService).toBe(osrmRoutingService)
    }
  })
})
