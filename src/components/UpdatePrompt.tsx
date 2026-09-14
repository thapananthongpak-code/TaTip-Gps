import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { isNativeApp } from '@/utils/platform'
import { BigButton } from './BigButton'

/**
 * แจ้งเมื่อมีเวอร์ชันใหม่ของแอป
 *
 * ตั้งใจไม่อัปเดตอัตโนมัติ เพราะการรีโหลดกลางทางจะทำให้การนำทางที่กำลังทำอยู่หลุด
 * ซึ่งอันตรายกับผู้ใช้ที่กำลังเดินอยู่ — ให้ผู้ใช้เลือกจังหวะเอง
 */
export function UpdatePrompt({ busy = false }: { busy?: boolean }) {
  /*
   * แอปที่ติดตั้งจาก APK อัปเดตด้วยการติดตั้งไฟล์ใหม่ทับ ไม่ใช่ผ่าน service worker
   * ถ้าไม่ดักไว้ ผู้ใช้จะเจอแถบ "มีเวอร์ชันใหม่" ทั้งที่เพิ่งติดตั้งเวอร์ชันใหม่ไปแล้ว
   *
   * ค่านี้คงที่ตลอดการเปิดแอปหนึ่งครั้ง การคืนค่าก่อนเรียก hook จึงไม่ทำให้ลำดับ hook เพี้ยน
   */
  if (isNativeApp()) return null
  return <WebUpdatePrompt busy={busy} />
}

/** แถบแจ้งเวอร์ชันใหม่ สำหรับตอนเปิดผ่านเว็บเท่านั้น */
function WebUpdatePrompt({ busy }: { busy: boolean }) {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <section
      aria-label={t('update.title')}
      className="flex flex-wrap items-center gap-2 bg-brand-700 px-4 py-3 text-white"
    >
      <p className="flex-1 text-base font-bold">
        {t(busy ? 'update.waitUntilStopped' : 'update.available')}
      </p>
      <BigButton variant="secondary" disabled={busy} onClick={() => void updateServiceWorker(true)}>
        {t('update.reload')}
      </BigButton>
      <BigButton variant="secondary" onClick={() => setNeedRefresh(false)}>
        {t('update.later')}
      </BigButton>
    </section>
  )
}
