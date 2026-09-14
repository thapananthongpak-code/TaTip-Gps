import { useSyncExternalStore } from 'react'
import { speechService } from '@/services'

/**
 * live region กลางของทั้งแอป — มีข้อความอยู่ข้างในเฉพาะตอนที่แอปพูดเองไม่ได้
 *
 * ต้องมีจุดเดียวและต้องถูก mount ไว้ตลอด ไม่ใช่โผล่มาตอนมีข้อความ
 * เพราะโปรแกรมอ่านหน้าจอจะประกาศเฉพาะการเปลี่ยนแปลงใน live region ที่มีอยู่ก่อนแล้ว
 * ถ้า mount พร้อมข้อความ ผู้ใช้จะไม่ได้ยินอะไรเลย
 *
 * key ที่เปลี่ยนตาม sequence บังคับให้ประกาศซ้ำได้แม้ข้อความจะเหมือนเดิม
 * เช่น "ระวังบันได" ที่เกิดขึ้นสองจุดติดกัน
 */
export function Announcer() {
  const state = useSyncExternalStore(speechService.subscribe, speechService.getSnapshot)

  /*
    ปล่อยว่างไว้ขณะที่แอปพูดเอง ไม่งั้นโปรแกรมอ่านหน้าจอจะอ่านประโยคเดียวกัน
    ซ้อนขึ้นมาอีกเสียงพร้อมกัน จนผู้ใช้จับใจความไม่ได้
  */
  const text = state.usingScreenReader ? state.text : ''

  /*
    สองช่องแยกตามความเร่งด่วน และต้อง mount ไว้ทั้งคู่ตลอดเวลา
    ข้อความหนึ่งชิ้นลงช่องเดียวเท่านั้น อีกช่องต้องว่าง ไม่งั้นจะถูกอ่านซ้ำสองรอบ

    คำเตือนที่รอไม่ได้ (บันไดข้างหน้า ออกนอกเส้นทาง ระบบล่ม) ใช้ assertive
    เพื่อตัดเข้าไปก่อนสิ่งที่โปรแกรมอ่านหน้าจอกำลังอ่านค้างอยู่
    ส่วนข้อความทั่วไปยังเป็น polite เพื่อไม่ให้ขัดจังหวะการสำรวจหน้าจอของผู้ใช้
  */
  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="announcer">
        <span key={state.sequence}>{state.assertive ? '' : text}</span>
      </div>
      <div
        className="sr-only"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="announcer-assertive"
      >
        <span key={state.sequence}>{state.assertive ? text : ''}</span>
      </div>
    </>
  )
}
