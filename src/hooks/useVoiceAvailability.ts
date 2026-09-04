import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { speechService } from '@/services'
import { useSpeech } from './useSpeech'

/**
 * รายชื่อเสียงของเบราว์เซอร์โหลดแบบไม่พร้อมกัน (getVoices() มักคืนค่าว่างในครั้งแรก)
 * จึงต้องรอสักครู่ก่อนสรุปว่า "ไม่มีเสียงภาษานี้จริงๆ"
 */
const VOICE_LOAD_GRACE_MS = 1500

/**
 * เตือนเมื่ออุปกรณ์ไม่มีเสียงพูดของภาษาที่เลือก
 *
 * บนเครื่องที่ไม่มีเสียงภาษาไทย ระบบจะอ่านไทยด้วยเสียงภาษาอังกฤษซึ่งฟังแทบไม่รู้เรื่อง
 * ผู้ใช้ที่มองไม่เห็นจะไม่มีทางรู้สาเหตุเลยถ้าไม่บอก
 */
export function useVoiceAvailability(enabled: boolean) {
  const { t, i18n } = useTranslation()
  const { speak } = useSpeech()
  const warnedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !speechService.isSupported()) return

    const language = currentLanguage()
    if (warnedRef.current === language) return

    const timer = setTimeout(() => {
      if (speechService.hasVoiceFor(language)) return
      warnedRef.current = language
      speak(t('language.noVoiceSpoken'))
    }, VOICE_LOAD_GRACE_MS)

    return () => clearTimeout(timer)
  }, [enabled, i18n.language, speak, t])
}
