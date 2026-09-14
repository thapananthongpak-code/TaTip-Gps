import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import en from '../src/i18n/locales/en.json'
import th from '../src/i18n/locales/th.json'

/**
 * ตรวจ "ประโยคที่ผู้ใช้ได้ยินจริง" ไม่ใช่แค่ว่าคีย์มีอยู่
 *
 * ประกอบประโยคด้วยตรรกะเดียวกับที่ใช้ตอนรัน แล้วตรวจผลลัพธ์เป็นข้อความ
 * เพราะบั๊กของระบบเสียงมักไม่ได้อยู่ที่คีย์หาย แต่อยู่ที่ประโยคที่ประกอบออกมา
 * แล้วฟังไม่รู้เรื่อง เช่น ตัวเลขสองชุดชนกัน หรือมีจุดลอยกลางประโยค
 */
beforeAll(async () => {
  await i18next.init({
    resources: { th: { translation: th }, en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['th', 'en'],
    interpolation: { escapeValue: false },
  })
})

const t = (lng: string, key: string, opts?: Record<string, unknown>) => {
  void i18next.changeLanguage(lng)
  return i18next.t(key, opts ?? {})
}

/** ตรงกับ describe() ใน useObstacleAlerts */
function stepsSentence(
  lng: string,
  opts: { count?: number; incline?: 'up' | 'down'; handrail?: boolean },
) {
  return t(lng, 'obstacle.stepsSpoken', {
    distance: t(lng, 'units.metersSpoken', { value: 25 }),
    direction: opts.incline ? t(lng, `obstacle.incline.${opts.incline}`) : '',
    count: opts.count ? t(lng, 'obstacle.stepCountSpoken', { count: opts.count }) : '',
    handrail: opts.handrail ? t(lng, 'obstacle.handrail') : '',
  })
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
}

/** ตรงกับการต่อรายการใน ObstacleReport */
function summary(lng: string, counts: Record<string, number>) {
  const parts = Object.entries(counts).map(([kind, count]) =>
    t(lng, `obstacle.count.${kind}`, { count }),
  )
  return parts.length > 1
    ? parts.slice(0, -1).join(t(lng, 'obstacle.listSeparator')) +
        t(lng, 'obstacle.listLast') +
        parts[parts.length - 1]
    : (parts[0] ?? '')
}

describe.each(['en', 'th'])('คำเตือนบันได (%s)', (lng) => {
  /*
   * OSM ส่วนใหญ่ไม่ระบุจำนวนขั้นหรือราวจับ ช่องเหล่านั้นจึงว่างเป็นเรื่องปกติ
   * ถ้าไม่เก็บกวาด ประโยคจะมีจุดลอยอย่าง "there are steps ."
   * ซึ่งเครื่องอ่านจะเว้นจังหวะผิดจนฟังเหมือนประโยคขาดหาย
   */
  it('ไม่มีช่องว่างค้างหน้าเครื่องหมายวรรคตอน แม้ไม่มีรายละเอียดเลย', () => {
    for (const opts of [
      {},
      { count: 12 },
      { incline: 'down' as const },
      { handrail: true },
      { count: 18, incline: 'up' as const, handrail: true },
    ]) {
      const sentence = stepsSentence(lng, opts)
      expect(sentence).not.toMatch(/\s[.,!?]/)
      expect(sentence).not.toMatch(/\s{2,}/)
      expect(sentence.trim()).toBe(sentence)
    }
  })

  it('บอกจำนวนขั้นโดยไม่พูดคำว่าบันไดซ้ำสองรอบ', () => {
    const sentence = stepsSentence(lng, { count: 12 })
    expect(sentence).toContain('12')
    // ภาษาอังกฤษเคยได้ "there are steps 12 steps" เพราะใช้คีย์เดียวกับที่แสดงบนจอ
    if (lng === 'en') expect(sentence).not.toMatch(/steps\s+\d+\s+steps/)
  })
})

describe.each(['en', 'th'])('สรุปสิ่งกีดขวางก่อนออกเดินทาง (%s)', (lng) => {
  it('ชนิดเดียวไม่ต้องมีตัวเชื่อม', () => {
    expect(summary(lng, { steps: 3 })).not.toContain(t(lng, 'obstacle.listLast').trim())
  })

  /*
   * เดิมต่อด้วยเว้นวรรคเปล่า ทำให้ได้ "บันได 3 จุด ประตูหรือเสากั้น 1 จุด"
   * เวลาอ่านออกเสียง ตัวเลขของสองรายการจะชนกันจนแยกไม่ออกว่าอะไรกี่จุด
   */
  it('หลายชนิดต้องมีตัวเชื่อมคั่น ไม่ใช่เว้นวรรคเปล่า', () => {
    const sentence = summary(lng, { steps: 3, barrier: 1 })
    expect(sentence).toContain(t(lng, 'obstacle.listLast').trim())
  })

  it('สามชนิดใช้ตัวคั่นระหว่างกลาง และตัวเชื่อมเฉพาะตัวสุดท้าย', () => {
    const sentence = summary(lng, { steps: 3, construction: 1, kerb: 2 })
    const joiner = t(lng, 'obstacle.listLast').trim()
    expect(sentence.split(joiner).length - 1).toBe(1)
  })
})

describe.each(['en', 'th'])('ประกาศถึงจุดหมาย (%s)', (lng) => {
  /*
   * ผู้ใช้ที่ฟังอย่างเดียวไม่มีทางรู้ว่ามีปุ่มจบการเดินทางอยู่บนจอ
   * ถ้าไม่บอก เขาจะยืนรอว่าจะเกิดอะไรขึ้นต่อ หรือไปกดปุ่มยกเลิกสีแดงแทน
   */
  it.each(['nav.arrivedSpoken', 'nav.arrivedNearSpoken'])('%s บอกว่ามีปุ่มจบการเดินทาง', (key) => {
    const sentence = t(lng, key, { destination: 'Siam Paragon', distance: '40 m' })
    const label = t(lng, 'nav.finishButton')
    expect(sentence.toLowerCase()).toContain(label.toLowerCase())
  })
})

describe('ภาษาที่ใช้กับผู้ใช้ ไม่ใช่ภาษาโปรแกรมเมอร์', () => {
  it('ข้อความเน็ตกลับมาไม่พูดถึง "คำขอที่ล้มเหลว"', () => {
    expect(t('en', 'offline.restoredSpoken').toLowerCase()).not.toContain('request')
    expect(t('th', 'offline.restoredSpoken')).not.toContain('คำขอ')
  })
})
