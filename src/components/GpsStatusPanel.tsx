import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseGeolocationResult } from '@/hooks/useGeolocation'
import { formatAge, formatDistance } from '@/utils/format'
import { BigButton } from './BigButton'

interface Props {
  geo: UseGeolocationResult
}

/**
 * สถานะ GPS แบบบรรทัดเดียว
 *
 * เดิมเป็นแผงเต็มพร้อมตารางสองคอลัมน์และปุ่มของตัวเอง ซึ่งกินพื้นที่มาก
 * ทั้งที่เนื้อหาจริงมีแค่สองค่า ย่อเหลือบรรทัดเดียวเพื่อลดความรกของหน้า
 * ส่วนการฟังรายละเอียดย้ายไปรวมกับปุ่ม "ฉันอยู่ที่ไหน" ให้เหลือปุ่มเดียว
 *
 * ยังคงแสดงไว้เสมอ ไม่ซ่อนในหน้าตั้งค่า เพราะความแม่นยำที่แย่ลง
 * คือสัญญาณว่าอย่าเชื่อการนำทางในตอนนั้น ซึ่งผู้ใช้ต้องเห็นตลอดเวลา
 */
export function GpsStatusPanel({ geo }: Props) {
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
      <section aria-label={t('gps.tracking')} className="gps-status is-error">
        <p className="font-bold">{t(`errors.${error.code}`)}</p>
        <BigButton variant="danger" onClick={geo.retry}>
          {t('errors.retryButton')}
        </BigButton>
      </section>
    )
  }

  const degraded = isPoorAccuracy || isStale || (position?.accuracy ?? 0) > 30

  return (
    <section aria-label={t('gps.tracking')} className="gps-status">
      <span className="font-bold">
        {status === 'acquiring' && t('gps.acquiring')}
        {status === 'tracking' && !isStale && t('gps.tracking')}
        {status === 'tracking' && isStale && t('gps.staleLabel')}
      </span>
      {position && (
        <span className={degraded ? 'gps-accuracy is-degraded' : 'gps-accuracy'}>
          ±{formatDistance(position.accuracy)} ·{' '}
          {degraded ? t('gps.accuracyPoor') : t('gps.accuracyGood')} ·{' '}
          {formatAge(position.timestamp, now)}
        </span>
      )}
    </section>
  )
}
