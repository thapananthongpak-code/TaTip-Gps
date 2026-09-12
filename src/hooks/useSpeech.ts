import { useCallback } from 'react'
import { speechService } from '@/services'
import type { SpeakOptions } from '@/services/interfaces'

/**
 * ครอบ speechService ให้ใช้ใน component ได้สะดวก
 *
 * แอปพยายามพูดด้วยเสียงของตัวเองก่อน แล้วถอยไปให้โปรแกรมอ่านหน้าจออ่านแทนถ้าพูดไม่ได้
 * ผู้เรียกไม่ต้องรู้ว่ากำลังใช้ทางไหนอยู่
 */
export function useSpeech() {
  const speak = useCallback((text: string, options?: SpeakOptions) => {
    speechService.speak(text, options)
  }, [])

  const cancel = useCallback(() => speechService.cancel(), [])

  /** ต้องเรียกจาก user gesture หนึ่งครั้ง ไม่งั้น iOS จะไม่ยอมให้แอปออกเสียง */
  const unlock = useCallback(() => speechService.unlock(), [])

  return { speak, cancel, unlock }
}
