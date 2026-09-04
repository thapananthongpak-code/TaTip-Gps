interface Entry<V> {
  value: V
  expiresAt: number
}

/**
 * cache ในหน่วยความจำแบบมีอายุและจำกัดจำนวน
 * ใช้ลดการยิง Nominatim ซ้ำสำหรับคำค้นเดิม (ผู้ใช้มักลบตัวอักษรแล้วพิมพ์กลับเข้าไปใหม่)
 *
 * ตั้งใจเก็บใน memory ไม่ลง localStorage เพราะเป็นข้อมูลที่โยงกับตำแหน่งผู้ใช้
 * ปิดแอปแล้วต้องหายไป (ดูหัวข้อความเป็นส่วนตัวใน README)
 */
export function createTtlCache<V>(ttlMs: number, maxEntries = 50) {
  const store = new Map<string, Entry<V>>()

  return {
    get(key: string): V | undefined {
      const hit = store.get(key)
      if (!hit) return undefined
      if (hit.expiresAt < Date.now()) {
        store.delete(key)
        return undefined
      }
      // แตะเพื่อให้เป็นรายการที่ใหม่ที่สุด (LRU อย่างง่ายบนลำดับของ Map)
      store.delete(key)
      store.set(key, hit)
      return hit.value
    },

    set(key: string, value: V): void {
      if (store.size >= maxEntries) {
        const oldest = store.keys().next()
        if (!oldest.done) store.delete(oldest.value)
      }
      store.set(key, { value, expiresAt: Date.now() + ttlMs })
    },

    clear(): void {
      store.clear()
    },
  }
}
