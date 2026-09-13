import { describe, expect, it } from 'vitest'
import { looksUnrelated, similarity } from '@/utils/similarity'

/**
 * ผู้ให้บริการค้นหาคืนผลที่ผิดตัวมาได้จริง พิมพ์ "รพ.รามา" แล้วได้ "สะพานพระราม 8"
 * ซึ่งอันตรายสำหรับคนที่มองไม่เห็น เพราะเลือกจากเสียงอย่างเดียว
 */
describe('looksUnrelated', () => {
  it.each([
    ['รพ.รามา', 'สะพานพระราม 8'],
    ['สยามพารากอนน', 'สยามราม่า'],
    ['SiamParagon', 'Siam Dragon'],
  ])('เตือนเมื่อ "%s" ได้ผลเป็น "%s"', (query, name) => {
    expect(looksUnrelated(query, name)).toBe(true)
  })

  it.each([
    ['Siam Paragn', 'Siam Paragon'],
    ['เซ็นทรัลเวิลด', 'เซ็นทรัลเวิลด์'],
    ['Centrl World', 'centralwOrld'],
  ])('ไม่เตือนเมื่อ "%s" ได้ผลเป็น "%s" ซึ่งถูกต้อง', (query, name) => {
    expect(looksUnrelated(query, name)).toBe(false)
  })

  it('ไม่เตือนเมื่อชื่อหนึ่งอยู่ในอีกชื่อ', () => {
    // คนพิมพ์ชื่อสั้นแล้วได้ชื่อเต็มเป็นเรื่องปกติ ไม่ใช่ผลผิดตัว
    expect(looksUnrelated('ศิริราช', 'โรงพยาบาลศิริราช')).toBe(false)
    expect(looksUnrelated('Siriraj', 'Siriraj Hospital')).toBe(false)
  })

  it('ไม่ตัดสินเมื่อคำค้นกับชื่อผลลัพธ์อยู่คนละสคริปต์', () => {
    /*
     * "Siam Paragon" กับ "สยามพารากอน" ถูกต้อง แต่ไม่มีตัวอักษรร่วมกันเลย
     * ถ้าตัดสินจากตัวอักษรจะเตือนผิดทุกครั้งที่ผู้ใช้พิมพ์อังกฤษแล้วได้ชื่อไทย
     * จึงถือว่าเกี่ยวข้องไว้ก่อน แล้วพึ่งการประกาศชื่อจุดหมายด้วยเสียงแทน
     */
    expect(looksUnrelated('Siam Paragon', 'สยามพารากอน')).toBe(false)
    // ข้อจำกัดที่ยอมรับ: ผลที่ผิดจริงข้ามสคริปต์ก็ตรวจไม่ได้เช่นกัน
    expect(looksUnrelated('Chatujak market', 'ถนนสีหบุรานุกิจ')).toBe(false)
  })

  it('ข้อความว่างไม่ทำให้พัง', () => {
    expect(looksUnrelated('', 'อะไรสักอย่าง')).toBe(false)
    expect(looksUnrelated('อะไรสักอย่าง', '')).toBe(false)
  })
})

describe('similarity', () => {
  it('ข้อความเดียวกันได้ 1 และไม่เกี่ยวกันเลยได้ 0', () => {
    expect(similarity('สยามพารากอน', 'สยามพารากอน')).toBe(1)
    expect(similarity('abc', 'xyz')).toBe(0)
  })

  it('ไม่สนตัวพิมพ์เล็กใหญ่ วรรค และเครื่องหมาย', () => {
    expect(similarity('Siam Paragon', 'siamparagon')).toBe(1)
    expect(similarity('ร.พ.ศิริราช', 'รพศิริราช')).toBe(1)
  })
})
