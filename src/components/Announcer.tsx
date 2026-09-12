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

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="announcer">
      {/*
        ปล่อยว่างไว้ขณะที่แอปพูดเอง ไม่งั้นโปรแกรมอ่านหน้าจอจะอ่านประโยคเดียวกัน
        ซ้อนขึ้นมาอีกเสียงพร้อมกัน จนผู้ใช้จับใจความไม่ได้
      */}
      <span key={state.sequence}>{state.usingScreenReader ? state.text : ''}</span>
    </div>
  )
}
