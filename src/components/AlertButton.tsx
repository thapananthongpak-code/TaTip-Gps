import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useSpeech } from '@/hooks/useSpeech'
import { alertSound } from '@/utils/alertSound'
import { vibrate } from '@/utils/vibration'
import { BigButton } from './BigButton'

/**
 * ปุ่มส่งเสียงขอความช่วยเหลือให้คนรอบข้างได้ยิน
 *
 * เป็นปุ่มเดียวที่สลับเปิดปิด ไม่ใช่กดค้างหรือกดยืนยันสองชั้น
 * เพราะในจังหวะที่ต้องการความช่วยเหลือ ทุกขั้นตอนที่เพิ่มเข้ามาคือเวลาที่เสียไป
 * ส่วนการกดโดยไม่ตั้งใจแก้ด้วยการพูดบอกทันทีว่ากดอะไรไปและหยุดอย่างไร
 * บวกกับการหยุดเองภายในหนึ่งนาที
 *
 * ⚠️ ไม่ใช่การแจ้งเหตุฉุกเฉิน ไม่ได้ติดต่อใครและไม่ส่งตำแหน่งไปที่ใด
 * ข้อความใต้ปุ่มบอกเรื่องนี้ไว้ตลอด เพื่อไม่ให้เข้าใจผิดว่ามีคนกำลังมาช่วยแน่นอน
 */
export function AlertButton() {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const playing = useSyncExternalStore(alertSound.subscribe, alertSound.getSnapshot)

  if (!alertSound.isSupported) {
    return <p className="hint">{t('alert.unavailable')}</p>
  }

  const toggle = () => {
    if (playing) {
      alertSound.stop()
      speak(t('alert.stoppedSpoken'), { priority: 'critical' })
      return
    }
    /*
     * เริ่มเสียงก่อนแล้วค่อยพูด เพราะความช่วยเหลือขึ้นกับเสียงที่คนอื่นได้ยิน
     * ไม่ใช่คำอธิบายที่ผู้ใช้ได้ยิน การรอพูดจบก่อนคือการหน่วงสิ่งที่สำคัญกว่า
     */
    alertSound.start()
    vibrate('hazard')
    speak(t('alert.startedSpoken'), { priority: 'critical' })
  }

  return (
    <>
      <BigButton
        variant="danger"
        onClick={toggle}
        aria-pressed={playing}
        className={playing ? 'alert-button is-active' : 'alert-button'}
      >
        {t(playing ? 'alert.stopButton' : 'alert.button')}
      </BigButton>
      <p className="hint">{t('alert.hint')}</p>
    </>
  )
}
