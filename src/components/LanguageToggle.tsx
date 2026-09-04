import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSpeech } from '@/hooks/useSpeech'
import { currentLanguage } from '@/i18n'
import { speechService } from '@/services'

/**
 * ปุ่มสลับภาษา ไทย <-> อังกฤษ
 *
 * รายละเอียดที่ตั้งใจทำเพื่อผู้ใช้ที่มองไม่เห็น:
 * - aria-label เขียนด้วย "ภาษาปลายทาง" เสมอ (ตอนใช้ไทยจะอ่านว่า "เปลี่ยนเป็นภาษาอังกฤษ")
 *   ผู้ใช้จึงรู้ว่ากดแล้วจะได้อะไร ไม่ใช่รู้แค่ว่าตอนนี้เป็นภาษาอะไร
 * - lang บนตัวป้ายกำกับไว้ให้ screen reader ออกเสียงชื่อภาษาด้วยสำเนียงที่ถูก
 * - ยกเลิกเสียงที่ค้างในคิวก่อนพูดยืนยัน ไม่งั้นจะได้ยินภาษาเก่าต่อจนจบ
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const { speak } = useSpeech()
  const active = currentLanguage()
  const nextLanguage = active === 'th' ? 'en' : 'th'

  const handleToggle = useCallback(async () => {
    speechService.cancel()
    await i18n.changeLanguage(nextLanguage)
    // อ่านคีย์เดิมใหม่หลังเปลี่ยนภาษาแล้ว จึงได้ประโยคยืนยันเป็นภาษาใหม่
    speak(i18n.t('language.switchedSpoken'), { priority: 'critical', language: nextLanguage })
  }, [i18n, nextLanguage, speak])

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={t('language.switchTo')}
      lang={nextLanguage}
      className="min-h-touch min-w-touch cursor-pointer rounded-xl border-2 border-white/70 px-4 py-2 text-lg font-bold text-white"
    >
      {t('language.switchToShort')}
    </button>
  )
}
