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

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const waitFor = lastRunAt + minIntervalMs - Date.now()
      if (waitFor > 0) await new Promise((resolve) => setTimeout(resolve, waitFor))
      lastRunAt = Date.now()
      return task()
    })
    // ให้คิวเดินต่อได้แม้ตัวก่อนหน้าจะพัง
    chain = run.catch(() => undefined)
    return run
  }
}
