/** ตัดทุกอย่างที่ไม่ใช่ตัวอักษรหรือตัวเลขออก แล้วทำให้เป็นตัวพิมพ์เล็ก */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function isThai(text: string): boolean {
  return /[฀-๿]/.test(text)
}

function bigrams(text: string): Set<string> {
  if (text.length < 2) return new Set([text])
  const out = new Set<string>()
  for (let i = 0; i < text.length - 1; i++) out.add(text.slice(i, i + 2))
  return out
}

/** ความคล้ายของสองข้อความ 0 ถึง 1 (Dice coefficient บนคู่ตัวอักษร) */
export function similarity(a: string, b: string): number {
  const first = bigrams(normalize(a))
  const second = bigrams(normalize(b))
  if (first.size === 0 || second.size === 0) return 0

  let shared = 0
  for (const gram of first) if (second.has(gram)) shared++
  return (2 * shared) / (first.size + second.size)
}

/**
 * ต่ำกว่านี้ถือว่าไม่เกี่ยวกัน
 *
 * วัดจากคำค้นจริง: ผลที่ถูกต้องได้ 0.84 ขึ้นไป ("Siam Paragn" กับ "Siam Paragon" ได้ 0.84,
 * "เซ็นทรัลเวิลด" กับ "เซ็นทรัลเวิลด์" ได้ 1.00)
 * ส่วนผลที่ผิดตัวได้ 0.74 ลงมา ("SiamParagon" กับ "Siam Dragon" ได้ 0.74,
 * "สยามพารากอนน" กับ "สยามราม่า" ได้ 0.47, "รพ.รามา" กับ "สะพานพระราม 8" ได้ 0.38)
 */
const UNRELATED_BELOW = 0.8

/**
 * ผลลัพธ์นี้ดู "ไม่ใช่สิ่งที่ผู้ใช้พิมพ์หา" หรือไม่
 *
 * ใช้เตือนผู้ใช้ก่อนที่เขาจะเลือกแล้วเดินไปผิดที่ เพราะคนที่มองไม่เห็น
 * ตัดสินจากเสียงอย่างเดียว และผู้ให้บริการค้นหาคืนผลที่ผิดตัวมาได้จริง
 *
 * ⚠️ ตัดสินไม่ได้เมื่อคำค้นกับชื่อผลลัพธ์อยู่คนละสคริปต์
 * เช่นพิมพ์ "Siam Paragon" แล้วได้ "สยามพารากอน" ซึ่งถูกต้อง แต่ไม่มีตัวอักษรร่วมกันเลย
 * กรณีนั้นจึงถือว่าเกี่ยวข้องไว้ก่อน แล้วพึ่งการประกาศชื่อจุดหมายด้วยเสียงก่อนเริ่มเดินแทน
 */
export function looksUnrelated(query: string, name: string): boolean {
  const a = normalize(query)
  const b = normalize(name)
  if (!a || !b) return false

  // คนละสคริปต์เทียบตัวอักษรกันไม่ได้ ไม่ตัดสิน
  if (isThai(a) !== isThai(b)) return false

  // ชื่อหนึ่งอยู่ในอีกชื่อ เช่น "ศิริราช" กับ "โรงพยาบาลศิริราช" ถือว่าเกี่ยวข้องกัน
  if (a.includes(b) || b.includes(a)) return false

  return similarity(a, b) < UNRELATED_BELOW
}
