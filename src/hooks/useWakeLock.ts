import { useEffect } from 'react'

/**
 * กันหน้าจอดับระหว่างนำทาง
 *
 * จำเป็นกับแอปนี้มากกว่าแอปนำทางทั่วไป เพราะผู้ใช้ที่มองไม่เห็นไม่มีเหตุผล
 * ที่จะแตะหน้าจอระหว่างเดิน เครื่องจึงล็อกตัวเองภายใน 30 วินาทีเสมอ
 *
 * เมื่อหน้าจอดับ เบราว์เซอร์จะยิง visibilitychange แล้วแอปจะพักการนำทาง
 * ผลคือผู้ใช้ได้ยินว่า "พักคำแนะนำชั่วคราว" แล้วเงียบไปตลอดทางที่เหลือ
 * ทั้งที่ยังเดินอยู่ ซึ่งเป็นสถานการณ์ที่อันตรายที่สุดของแอปนำทางด้วยเสียง
 *
 * ⚠️ ไม่ใช่ทุกเครื่องที่รองรับ (iOS Safari รองรับตั้งแต่ 16.4)
 * ถ้าขอไม่ได้ก็เงียบไป แล้วกลไกพักการนำทางเดิมยังทำงานเป็นด่านสุดท้ายอยู่
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    let released = false
    let sentinel: WakeLockSentinel | null = null

    const request = async () => {
      // ขอซ้ำไม่ได้ถ้ายังถืออยู่ และขอตอนหน้าจอถูกซ่อนอยู่จะโดนปฏิเสธเสมอ
      if (released || sentinel !== null || document.visibilityState !== 'visible') return
      try {
        const lock = await navigator.wakeLock?.request('screen')
        if (!lock) return
        if (released) {
          void lock.release().catch(() => undefined)
          return
        }
        sentinel = lock
        // ระบบปฏิบัติการปล่อย lock เองได้ (เช่นผู้ใช้กดปุ่มปิดหน้าจอ) ต้องรู้เพื่อขอใหม่ได้
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null
        })
      } catch {
        // ถูกปฏิเสธหรือเบราว์เซอร์ไม่รองรับ — ไม่ใช่เรื่องที่ต้องรบกวนผู้ใช้
      }
    }

    // กลับมาเห็นหน้าจออีกครั้งต้องขอใหม่ เพราะ lock หลุดไปตอนที่ถูกซ่อน
    const onVisibility = () => void request()
    document.addEventListener('visibilitychange', onVisibility)
    void request()

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => undefined)
      sentinel = null
    }
  }, [active])
}
