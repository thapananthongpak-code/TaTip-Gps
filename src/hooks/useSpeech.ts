import { useCallback, useMemo } from 'react'
import { speechService } from '@/services'
import type { SpeakOptions } from '@/services/interfaces'

/** ครอบ speechService ให้ใช้ใน component ได้สะดวก และให้ mock ง่ายตอนเทสต์ */
export function useSpeech() {
  const supported = useMemo(() => speechService.isSupported(), [])

  const speak = useCallback((text: string, options?: SpeakOptions) => {
    speechService.speak(text, options)
  }, [])

  const cancel = useCallback(() => speechService.cancel(), [])

  /** เรียกครั้งเดียวจาก user gesture แรก เพื่อปลดล็อกเสียงบน iOS */
  const unlock = useCallback(() => speechService.unlock(), [])

  return { supported, speak, cancel, unlock }
}
