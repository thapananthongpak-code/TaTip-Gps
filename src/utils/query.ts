/**
 * คำนำหน้าทั่วไปที่คนพูดติดปาก แต่ไม่มีอยู่ในชื่อสถานที่จริงในแผนที่
 *
 * Nominatim จับคำแบบตรงตัว การพิมพ์คำที่ไม่มีในชื่อจริงแม้คำเดียวทำให้ไม่เจอเลย
 * เช่นชื่อจริงในแผนที่คือ "สถานีวัดพระศรีมหาธาตุ" แต่คนพิมพ์ "สถานีรถไฟฟ้าวัดพระศรีมหาธาตุ"
 *
 * เรียงจากยาวไปสั้น เพื่อให้ตัด "สถานีรถไฟฟ้า" ก่อน "สถานี"
 */
const GENERIC_PREFIXES = [
  'สถานีรถไฟฟ้า',
  'สถานีรถไฟ',
  'สถานีขนส่ง',
  'ห้างสรรพสินค้า',
  'รถไฟฟ้า',
  'สถานี',
  'บีทีเอส',
  'เอ็มอาร์ที',
  'ห้าง',
  'ร้าน',
  'bts',
  'mrt',
  'arl',
]

/**
 * ตัวย่อที่คนไทยพิมพ์กันจริง กับคำเต็มที่ใช้ในแผนที่
 *
 * ทดสอบแล้วพบว่าทั้ง Nominatim และ Photon ไม่รู้จักตัวย่อเลย
 * "ร.พ.ศิริราช" ได้ "ถนน ร.พ.ช." และ "รร.สวนกุหลาบ" ไม่เจออะไรเลย
 *
 * ตัวย่อหนึ่งตัวขยายได้หลายแบบ เช่น "รร." เป็นได้ทั้งโรงเรียนและโรงแรม
 * จึงเก็บเป็นรายการแล้วลองทีละแบบ ไม่เดาว่าผู้ใช้หมายถึงอะไร
 */
const ABBREVIATIONS: { short: string; full: string[] }[] = [
  { short: 'รพ', full: ['โรงพยาบาล'] },
  { short: 'รร', full: ['โรงเรียน', 'โรงแรม'] },
  { short: 'รฟฟ', full: ['รถไฟฟ้า'] },
  { short: 'รฟ', full: ['รถไฟ', 'รถไฟฟ้า'] },
  { short: 'สภ', full: ['สถานีตำรวจภูธร'] },
  { short: 'สน', full: ['สถานีตำรวจนครบาล', 'สถานีตำรวจ'] },
  { short: 'มธ', full: ['มหาวิทยาลัยธรรมศาสตร์'] },
  { short: 'มก', full: ['มหาวิทยาลัยเกษตรศาสตร์'] },
  { short: 'มช', full: ['มหาวิทยาลัยเชียงใหม่'] },
  { short: 'มข', full: ['มหาวิทยาลัยขอนแก่น'] },
  { short: 'มอ', full: ['มหาวิทยาลัยสงขลานครินทร์'] },
  { short: 'จุฬา', full: ['จุฬาลงกรณ์มหาวิทยาลัย'] },
  { short: 'อบต', full: ['องค์การบริหารส่วนตำบล'] },
  { short: 'ม', full: ['มหาวิทยาลัย', 'หมู่บ้าน'] },
  { short: 'ถ', full: ['ถนน'] },
  { short: 'ซ', full: ['ซอย'] },
  { short: 'ต', full: ['ตำบล'] },
  { short: 'อ', full: ['อำเภอ'] },
  { short: 'จ', full: ['จังหวัด'] },
]

/** เหลือน้อยกว่านี้แล้วค้นหาไม่มีความหมาย */
const MIN_LENGTH = 2

/**
 * ขยายตัวย่อที่อยู่ต้นคำค้น
 *
 * รองรับทั้งแบบมีจุดและไม่มีจุด มีวรรคและไม่มีวรรค เพราะคนพิมพ์ไม่เหมือนกัน:
 * "รพ.ศิริราช" "ร.พ.ศิริราช" "รพ ศิริราช" "รพศิริราช"
 */
function expandAbbreviations(query: string): string[] {
  const out: string[] = []

  for (const { short, full } of ABBREVIATIONS) {
    // อนุญาตให้มีจุดคั่นระหว่างตัวอักษรของตัวย่อ แล้วตามด้วยจุดหรือวรรคหรือติดกันเลย
    const letters = [...short].join('\\.?')
    const pattern = new RegExp(`^${letters}\\.?\\s*`, 'i')
    if (!pattern.test(query)) continue

    const rest = query.replace(pattern, '').trim()
    if (rest.length < MIN_LENGTH) continue
    for (const word of full) out.push(`${word}${rest}`)
    break
  }

  return out
}

/**
 * รูปแบบอื่นของคำค้นที่ควรลองเมื่อคำเดิมไม่เจออะไรเลย
 *
 * คืนเป็นรายการเรียงตามลำดับที่ควรลอง ไม่ซ้ำกับคำเดิม
 * แต่ละรูปแบบคือความผิดพลาดแบบที่คนพิมพ์จริงทำ ไม่ใช่การเดาสุ่ม:
 *
 * - ใช้ตัวย่อ เช่น "รพ.ศิริราช" แทน "โรงพยาบาลศิริราช"
 * - พิมพ์คำนำหน้าที่ไม่มีในชื่อจริง เช่น "สถานีรถไฟฟ้าวัดพระศรีมหาธาตุ"
 * - ไม่เว้นวรรคหน้าตัวเลข เช่น "หมอชิต2" แทน "หมอชิต 2"
 *
 * ยิงเพิ่มเฉพาะตอนที่ผลลัพธ์ว่างจริงเท่านั้น จึงไม่เพิ่มภาระในกรณีปกติ
 */
export function queryVariants(query: string): string[] {
  const original = query.trim()
  const variants: string[] = []

  const add = (candidate: string) => {
    const trimmed = candidate.trim()
    if (trimmed.length >= MIN_LENGTH && trimmed !== original && !variants.includes(trimmed)) {
      variants.push(trimmed)
    }
  }

  // ขยายตัวย่อก่อน เพราะตัวย่ออยู่หน้าสุดและทำให้ทั้งคำค้นเพี้ยน
  for (const expanded of expandAbbreviations(original)) add(expanded)

  const lower = original.toLowerCase()
  for (const prefix of GENERIC_PREFIXES) {
    if (lower.startsWith(prefix)) {
      add(original.slice(prefix.length))
      break
    }
  }

  // เว้นวรรคหน้าตัวเลขที่ติดกับตัวอักษร
  add(original.replace(/([^\d\s])(\d)/g, '$1 $2'))

  // ตัดจุดและวรรคส่วนเกินออก เผื่อว่าชื่อจริงเขียนติดกัน
  add(original.replace(/[.\s]+/g, ''))

  return variants
}

/**
 * คำค้นที่สั้นลงสำหรับ "หาสถานที่ใกล้เคียง" เมื่อทุกวิธีข้างบนไม่เจออะไรเลย
 *
 * ตัดท้ายทีละส่วนเพื่อให้เหลือแต่ส่วนต้นที่น่าจะสะกดถูก
 * เพราะคนมักพิมพ์ต้นคำถูกแล้วพลาดตอนท้าย เช่นพิมพ์ "เซ็นทรัลเวิลด" แทน "เซ็นทรัลเวิลด์"
 *
 * ผลที่ได้อาจไม่ใช่สิ่งที่ผู้ใช้ต้องการเป๊ะ แต่ดีกว่าหน้าจอว่างเปล่า
 * เพราะอย่างน้อยผู้ใช้ได้เห็นว่ามีอะไรชื่อใกล้เคียงอยู่บ้าง
 */
export function shortenedQueries(query: string): string[] {
  const original = query.trim()
  const out: string[] = []

  // ตัดคำท้ายออกทีละคำ (สำหรับคำค้นที่มีวรรค)
  const words = original.split(/\s+/)
  for (let count = words.length - 1; count >= 1; count--) {
    const candidate = words.slice(0, count).join(' ')
    if (candidate.length >= MIN_LENGTH + 1) out.push(candidate)
  }

  // ตัดตัวอักษรท้ายออกทีละ 2 ตัว สำหรับคำไทยที่เขียนติดกันไม่มีวรรค
  for (const length of [original.length - 2, original.length - 4]) {
    if (length >= MIN_LENGTH + 1) {
      const candidate = original.slice(0, length)
      if (!out.includes(candidate)) out.push(candidate)
    }
  }

  return out.slice(0, 3)
}
