import { describe, expect, it } from 'vitest'
import {
  addressForLanguage,
  hasThaiScript,
  matchesLanguage,
  speakableStreet,
} from '../src/utils/script'

describe('hasThaiScript', () => {
  it.each([
    ['ถนนเพลินจิต', true],
    ['Ploenchit Road', false],
    ['Soi Sukhumvit 22', false],
    ['ซอยสุขุมวิท 22', true],
    ['', false],
  ])('%s -> %s', (text, expected) => expect(hasThaiScript(text)).toBe(expected))
})

describe('speakableStreet', () => {
  /*
   * วัดจริง: ชื่อถนนจาก OSRM ในกรุงเทพเป็นภาษาไทย 100%
   * โหมดอังกฤษจึงได้ "turn left near ถนนเพลินจิต" ทุกครั้งถ้าไม่กรอง
   */
  it('โหมดอังกฤษข้ามชื่อถนนภาษาไทย', () => {
    expect(speakableStreet('ถนนเพลินจิต', 'en')).toBeUndefined()
  })

  it('โหมดอังกฤษเก็บชื่อถนนที่เป็นอักษรละติน', () => {
    expect(speakableStreet('Ploenchit Road', 'en')).toBe('Ploenchit Road')
  })

  /** โหมดไทยรับได้ทั้งสองแบบ คนไทยอ่านชื่ออังกฤษที่ปนมาได้อยู่แล้ว */
  it.each(['ถนนเพลินจิต', 'Ploenchit Road'])('โหมดไทยเก็บ %s ไว้', (name) => {
    expect(speakableStreet(name, 'th')).toBe(name)
  })

  it('ไม่มีชื่อถนนก็คืน undefined', () => {
    expect(speakableStreet(undefined, 'en')).toBeUndefined()
    expect(speakableStreet('', 'th')).toBeUndefined()
  })
})

describe('addressForLanguage', () => {
  const mixed =
    'Ramathibodi Hospital, Kamphaeng Phet 5 Road, ชุมชนสระแก้ว, Thung Phaya Thai Subdistrict, Bangkok'

  it('โหมดอังกฤษตัดส่วนที่เป็นภาษาไทยออก', () => {
    const result = addressForLanguage(mixed, 'en')
    expect(result).not.toContain('ชุมชนสระแก้ว')
    expect(result).toContain('Ramathibodi Hospital')
    expect(result).toContain('Bangkok')
  })

  it('โหมดไทยคงที่อยู่เดิมไว้ทั้งหมด', () => {
    expect(addressForLanguage(mixed, 'th')).toBe(mixed)
  })

  /** ที่อยู่ที่อ่านยากยังดีกว่าไม่มีที่อยู่เลย */
  it('ถ้าตัดแล้วไม่เหลืออะไร คืนที่อยู่เดิม', () => {
    const allThai = 'ซอยสุขุมวิท 22, แขวงคลองเตย, กรุงเทพมหานคร'
    expect(addressForLanguage(allThai, 'en')).toBe(allThai)
  })
})

describe('matchesLanguage', () => {
  it('ข้อความว่างไม่ถือว่าตรงกับภาษาใด', () => {
    expect(matchesLanguage('   ', 'en')).toBe(false)
    expect(matchesLanguage('', 'th')).toBe(false)
  })
})
