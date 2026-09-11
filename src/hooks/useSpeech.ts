import { useCallback } from 'react'
import { speechService } from '@/services'
import type { SpeakOptions } from '@/services/interfaces'

/**
 * ครอบ speechService ให้ใช้ใน component ได้สะดวก
 *
 * ข้อความถูกประกาศผ่าน live region ให้โปรแกรมอ่านหน้าจอเป็นผู้อ่าน
 * จึงไม่ต้องบอกภาษาหรือปลดล็อกเสียงเหมือนตอนที่แอปสังเคราะห์เสียงเอง
 * เพราะโปรแกรมอ่านหน้าจออ่านตามภาษาของเนื้อหาบนหน้าอยู่แล้ว
 */
export function useSpeech() {
  const speak = useCallback((text: string, options?: SpeakOptions) => {
    speechService.speak(text, options)
  }, [])

  const cancel = useCallback(() => speechService.cancel(), [])

  return { speak, cancel }
}
