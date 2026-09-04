import { useCallback, useMemo } from 'react'
import { currentLanguage } from '@/i18n'
import { speechService } from '@/services'
import type { SpeakOptions } from '@/services/interfaces'

/**
 * ครอบ speechService ให้ใช้ใน component ได้สะดวก
 *
 * ทุกครั้งที่พูด จะแนบภาษาปัจจุบันไปด้วยเสมอ ไม่ต้องให้ผู้เรียกจำเอง
 * ป้องกันกรณีสลับภาษาแล้วมีข้อความค้างในคิวที่ยังใช้ภาษาเดิม
 */
export function useSpeech() {
  const supported = useMemo(() => speechService.isSupported(), [])

  // อ่านภาษาปัจจุบันตอนที่ "เรียกพูด" ไม่ใช่ตอนสร้าง callback
  // จึงได้ภาษาล่าสุดเสมอโดยไม่ต้องผูกภาษาเป็น dependency
  const speak = useCallback((text: string, options?: SpeakOptions) => {
    speechService.speak(text, { language: currentLanguage(), ...options })
  }, [])

  const cancel = useCallback(() => speechService.cancel(), [])

  /** เรียกครั้งเดียวจาก user gesture แรก เพื่อปลดล็อกเสียงบน iOS */
  const unlock = useCallback(() => speechService.unlock(), [])

  return { supported, speak, cancel, unlock }
}
