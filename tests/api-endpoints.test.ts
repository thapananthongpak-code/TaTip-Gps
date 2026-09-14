import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import places from '../api/places'
import reverse from '../api/reverse'
import route from '../api/route'

/**
 * endpoint ฝั่งเซิร์ฟเวอร์ที่ Vercel จะ deploy ให้
 *
 * ตอนนี้โปรเจกต์ใช้ OpenStreetMap จึงไม่ได้ตั้งคีย์ Google ไว้
 * endpoint พวกนี้จึงอยู่เฉยๆ แต่ยัง deploy ขึ้นไปด้วย
 * ต้องมั่นใจว่ามันตอบอย่างสุภาพ ไม่ใช่ crash หรือทำให้ทั้ง deployment พัง
 */
const req = (url: string, headers: Record<string, string> = {}) =>
  new Request(`https://example.com${url}`, { headers })

const saved = { ...process.env }
beforeEach(() => {
  delete process.env.GOOGLE_MAPS_SERVER_KEY
  delete process.env.API_TOKEN
})
afterEach(() => {
  process.env = { ...saved }
})

describe('เมื่อยังไม่ได้ตั้งคีย์ Google (สถานะปัจจุบัน)', () => {
  it.each([
    ['places', places, '/api/places?q=siam'],
    ['reverse', reverse, '/api/reverse?lat=13.7&lng=100.5'],
    ['route', route, '/api/route?fromLat=13.7&fromLng=100.5&toLat=13.8&toLng=100.6'],
  ])('%s ตอบ 503 พร้อมเหตุผล ไม่ใช่ crash', async (_name, handler, url) => {
    const response = await handler(req(url))
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) })
  })
})

describe('ตรวจข้อมูลเข้าก่อนยิงต่อไปหา Google', () => {
  beforeEach(() => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key'
  })

  it('ปฏิเสธคำค้นที่สั้นเกินไป', async () => {
    expect((await places(req('/api/places?q=a'))).status).toBe(400)
  })

  it('ปฏิเสธคำค้นที่ยาวผิดปกติ', async () => {
    expect((await places(req(`/api/places?q=${'x'.repeat(250)}`))).status).toBe(400)
  })

  it('ปฏิเสธพิกัดที่อยู่นอกโลก', async () => {
    expect((await reverse(req('/api/reverse?lat=999&lng=100'))).status).toBe(400)
  })

  it('ปฏิเสธเส้นทางที่ขาดพิกัดปลายทาง', async () => {
    expect((await route(req('/api/route?fromLat=13.7&fromLng=100.5'))).status).toBe(400)
  })

  /*
   * Number(null) และ Number('') ได้ 0 ทั้งคู่ ไม่ใช่ NaN
   * พิกัดที่หายไปจึงเคยกลายเป็น (0, 0) กลางมหาสมุทรแอตแลนติกแล้วผ่านการตรวจไปได้
   * แล้วยิงไปหา Google จริง ทั้งที่ควรปฏิเสธตั้งแต่ต้น
   */
  it.each([
    ['ไม่ส่งพิกัดมาเลย', '/api/reverse'],
    ['ส่งค่าว่าง', '/api/reverse?lat=&lng='],
    ['ส่งค่าว่างเฉพาะ lng', '/api/reverse?lat=13.7&lng='],
    ['ส่งตัวอักษรแทนตัวเลข', '/api/reverse?lat=abc&lng=def'],
  ])('ไม่ตีความ %s ว่าเป็นพิกัด (0, 0)', async (_case, url) => {
    expect((await reverse(req(url))).status).toBe(400)
  })

  it('เส้นทางที่ขาดพิกัดฝั่งใดฝั่งหนึ่งก็ต้องถูกปฏิเสธ', async () => {
    expect((await route(req('/api/route?toLat=13.8&toLng=100.6'))).status).toBe(400)
    expect((await route(req('/api/route'))).status).toBe(400)
  })
})

describe('โทเค็นร่วมกันคนอื่นมายิง endpoint จนบิลบาน', () => {
  beforeEach(() => {
    process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key'
    process.env.API_TOKEN = 'secret'
  })

  it('ไม่มีโทเค็น = ถูกปฏิเสธก่อนถึง Google', async () => {
    expect((await places(req('/api/places?q=siam'))).status).toBe(403)
  })

  it('โทเค็นผิด = ถูกปฏิเสธ', async () => {
    const response = await places(req('/api/places?q=siam', { 'x-taathip-token': 'wrong' }))
    expect(response.status).toBe(403)
  })

  /* โทเค็นถูกต้องต้องผ่านด่านนี้ไปได้ (ไปตกที่ 400 เพราะคำค้นสั้น ไม่ใช่ 403) */
  it('โทเค็นถูกต้อง = ผ่านด่านตรวจสิทธิ์', async () => {
    const response = await places(req('/api/places?q=a', { 'x-taathip-token': 'secret' }))
    expect(response.status).toBe(400)
  })
})
