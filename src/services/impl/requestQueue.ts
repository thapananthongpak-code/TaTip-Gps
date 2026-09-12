import { ServiceError } from '@/types'

/**
 * บังคับให้คำขอออกไปห่างกันอย่างน้อย N มิลลิวินาที
 *
 * จำเป็นสำหรับ Nominatim ที่มีนโยบายชัดเจนว่าห้ามเกิน 1 คำขอต่อวินาที
 * ต่อให้ debounce ที่ UI แล้ว ก็ยังมีทางที่คำขอจะชนกันได้ (เช่น ค้นหา + reverse geocoding
 * เกิดพร้อมกัน) ตัวคุมคิวนี้เป็นด่านสุดท้ายที่รับประกันจังหวะการยิงจริง
 */
export function createRateLimiter(minIntervalMs: number) {
  let chain: Promise<unknown> = Promise.resolve()
  let lastRunAt = 0

  return function schedule<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const run = chain.then(async () => {
      /*
       * ทิ้งงานที่ถูกยกเลิกไปแล้วทันที ไม่ต้องรอคิวของตัวเอง
       *
       * สำคัญเพราะผู้ใช้กดปุ่มหมวดหลายปุ่มติดกันได้ ทุกครั้งที่กดใหม่จะยกเลิกของเดิม
       * ถ้างานที่ยกเลิกแล้วยังกินช่องคิวของมันอยู่ คำขอล่าสุดจะต้องรอต่อท้าย
       * ทีละหนึ่งวินาทีครึ่งจนกลายเป็นรอหลายสิบวินาที แล้วผู้ใช้เห็นแค่คำว่า "กำลังค้นหา"
       */
      if (signal?.aborted) throw new ServiceError('ABORTED')

      const waitFor = lastRunAt + minIntervalMs - Date.now()
      if (waitFor > 0) await new Promise((resolve) => setTimeout(resolve, waitFor))

      // เช็กอีกครั้งหลังรอ เพราะระหว่างที่รออยู่ผู้ใช้อาจกดปุ่มอื่นไปแล้ว
      if (signal?.aborted) throw new ServiceError('ABORTED')

      lastRunAt = Date.now()
      return task()
    })
    // ให้คิวเดินต่อได้แม้ตัวก่อนหน้าจะพัง
    chain = run.catch(() => undefined)
    return run
  }
}
