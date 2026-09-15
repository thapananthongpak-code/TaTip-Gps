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
 * - ป้ายบนปุ่มเขียนด้วยภาษาอังกฤษทั้งสองโหมด ("Thai" กับ "EN") จึงกำกับ lang="en" ไว้คงที่
 *   ไม่ใช่กำกับตามภาษาปลายทาง ซึ่งจะทำให้เสียงไทยไปอ่านคำว่า "Thai" ผิดสำเนียง
 *   ถ้าวันหลังเปลี่ยนป้ายเป็นคำไทย ต้องแก้ตรงนี้ด้วย
 * - ยกเลิกข้อความที่ค้างในคิวก่อนประกาศยืนยัน ไม่งั้นจะได้ยินภาษาเก่าต่อจนจบ
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
    speak(i18n.t('language.switchedSpoken'), { priority: 'critical' })
  }, [i18n, nextLanguage, speak])

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={t('language.switchTo')}
      className="min-h-touch min-w-touch cursor-pointer rounded-xl border-2 border-white/70 px-4 py-2 text-lg font-bold text-white"
    >
      <span lang="en">{t('language.switchToShort')}</span>
    </button>
  )
}
