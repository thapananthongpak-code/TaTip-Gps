import { describe, expect, it } from 'vitest'
import { geocodingService, routingService, USE_GOOGLE } from '../src/services'
import { compositeGeocodingService } from '../src/services/impl/compositeGeocodingService'
import { osrmRoutingService } from '../src/services/impl/osrmRoutingService'

/**
 * ค่าเริ่มต้นของโปรเจกต์คือชุดฟรีที่ไม่ต้องผูกบัตรเครดิต
 *
 * Google Maps Platform บังคับผูกบัตรก่อนจึงจะเปิด API ได้ แม้จะมีโควตาฟรีให้ก็ตาม
 * โปรเจกต์นี้จึงต้องเดินได้เต็มรูปแบบโดยไม่ต้องมีคีย์ ไม่ใช่แค่ "เปิดได้แต่ใช้ไม่ได้"
 *
 * เทสต์นี้กันการเผลอสลับค่าเริ่มต้นไปเป็น Google ในอนาคต
 * ซึ่งจะทำให้คนที่ clone โปรเจกต์ไปเจอแอปที่ค้นหาไม่ได้และนำทางไม่ได้ตั้งแต่เปิด
 */
describe('ผู้ให้บริการค่าเริ่มต้น', () => {
  it('ไม่ได้ตั้งคีย์ = ไม่ใช้ Google', () => {
    expect(USE_GOOGLE).toBe(false)
  })

  it('ค้นหาสถานที่ใช้ Nominatim + Photon ตามเดิม', () => {
    expect(geocodingService).toBe(compositeGeocodingService)
  })

  it('เส้นทางเดินเท้าใช้ OSRM ตามเดิม', () => {
    expect(routingService).toBe(osrmRoutingService)
  })
})
