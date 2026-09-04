import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseGeolocationResult } from '@/hooks/useGeolocation'
import { formatAge, formatDistance } from '@/utils/format'
import { BigButton } from './BigButton'

interface Props {
  geo: UseGeolocationResult
  onRepeatStatus: () => void
}

/**
 * แผงสถานะ GPS — เป็น "แหล่งข้อมูลหลัก" ของแอปสำหรับผู้ใช้ที่มองไม่เห็น
 * ทุกอย่างที่แผนที่สื่อด้วยภาพ ต้องมีข้อความเทียบเท่าอยู่ในนี้ และประกาศผ่าน aria-live
 */
export function GpsStatusPanel({ geo, onRepeatStatus }: Props) {
  const { t } = useTranslation()
  const { status, position, error, isPoorAccuracy, isStale } = geo
  const [now, setNow] = useState(() => Date.now())

  // เดินนาฬิกาเพื่อให้ "อัปเดตล่าสุด" เป็นข้อมูลสดเสมอ ไม่ใช่ค้างอยู่ที่ค่าเดิม
  useEffect(() => {
    if (status !== 'tracking') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [status])

  if (error) {
    return (
      <section
        aria-label={t('gps.tracking')}
        className="border-t-4 border-danger-500 bg-danger-500/10 p-4"
      >
        <p role="alert" className="text-lg font-bold text-danger-600 dark:text-red-300">
          {t(`errors.${error.code}`)}
        </p>
        <BigButton variant="danger" onClick={geo.retry} className="mt-3 w-full">
          {t('errors.retryButton')}
        </BigButton>
      </section>
    )
  }

  const degraded = isPoorAccuracy || isStale

  return (
    <section
      aria-label={t('gps.tracking')}
      className="border-t-2 border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      {/* ประกาศสถานะให้ screen reader ทราบทุกครั้งที่เปลี่ยน โดยไม่ขัดจังหวะสิ่งที่กำลังอ่านอยู่ */}
      <p aria-live="polite" className="text-lg font-bold">
        {status === 'acquiring' && t('gps.acquiring')}
        {status === 'tracking' && !isStale && t('gps.tracking')}
        {status === 'tracking' && isStale && t('gps.staleLabel')}
      </p>

      {position && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-base">
          <dt className="text-slate-600 dark:text-slate-300">{t('gps.accuracyLabel')}</dt>
          <dd
            className={`font-bold ${degraded ? 'text-danger-600 dark:text-red-300' : 'text-safe-500 dark:text-green-300'}`}
          >
            ±{formatDistance(position.accuracy)} (
            {degraded ? t('gps.accuracyPoor') : t('gps.accuracyGood')})
          </dd>

          <dt className="text-slate-600 dark:text-slate-300">{t('gps.lastUpdate')}</dt>
          <dd className="font-bold">{formatAge(position.timestamp, now)}</dd>
        </dl>
      )}

      <BigButton variant="secondary" onClick={onRepeatStatus} className="mt-3 w-full">
        {t('actions.repeatStatus')}
      </BigButton>
    </section>
  )
}
