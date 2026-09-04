import { useTranslation } from 'react-i18next'

/**
 * แถบแจ้งเตือนเมื่อไม่มีอินเทอร์เน็ต
 *
 * บอกให้ชัดว่า "อะไรยังใช้ได้" และ "อะไรใช้ไม่ได้" ไม่ใช่แค่บอกว่าออฟไลน์
 * เพราะแผนที่ที่แคชไว้ยังแสดงอยู่ ผู้ใช้จึงอาจเข้าใจผิดว่าทุกอย่างปกติดี
 */
export function OfflineBanner() {
  const { t } = useTranslation()
  return (
    <p
      role="alert"
      className="bg-amber-100 px-4 py-3 text-base font-bold text-amber-950 dark:bg-amber-200 dark:text-amber-950"
    >
      {t('offline.banner')}
    </p>
  )
}
