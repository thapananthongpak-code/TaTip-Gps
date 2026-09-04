import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { BigButton } from './BigButton'

/**
 * แจ้งเมื่อมีเวอร์ชันใหม่ของแอป
 *
 * ตั้งใจไม่อัปเดตอัตโนมัติ เพราะการรีโหลดกลางทางจะทำให้การนำทางที่กำลังทำอยู่หลุด
 * ซึ่งอันตรายกับผู้ใช้ที่กำลังเดินอยู่ — ให้ผู้ใช้เลือกจังหวะเอง
 */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <section
      role="alert"
      aria-label={t('update.title')}
      className="flex flex-wrap items-center gap-2 bg-brand-700 px-4 py-3 text-white"
    >
      <p className="flex-1 text-base font-bold">{t('update.available')}</p>
      <BigButton variant="secondary" onClick={() => void updateServiceWorker(true)}>
        {t('update.reload')}
      </BigButton>
      <BigButton variant="secondary" onClick={() => setNeedRefresh(false)}>
        {t('update.later')}
      </BigButton>
    </section>
  )
}
