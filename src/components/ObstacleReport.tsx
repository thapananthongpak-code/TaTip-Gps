import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSpeech } from '@/hooks/useSpeech'
import type { ObstacleKind, ObstacleReport as Report } from '@/types'
import { formatDistance, speakDistance } from '@/utils/format'
import { BigButton } from './BigButton'

interface Props {
  report: Report
  isScanning: boolean
  /** ประกาศสรุปด้วยเสียงอัตโนมัติหนึ่งครั้งเมื่อสแกนเสร็จ */
  announce: boolean
}

/** เรียงตามความอันตราย เพื่อให้ประโยคสรุปขึ้นต้นด้วยเรื่องที่สำคัญที่สุดก่อน */
const KIND_ORDER: ObstacleKind[] = [
  'steps',
  'construction',
  'barrier',
  'kerb',
  'crossing_no_tactile',
  'narrow',
]

/**
 * รายงานสิ่งกีดขวางก่อนเริ่มเดิน
 *
 * ตั้งใจให้ผู้ใช้ได้ยิน "ภาพรวมทั้งเส้นทาง" ก่อนก้าวแรก
 * ไม่ใช่รู้ทีละจุดตอนเดินไปถึงแล้ว เพราะการรู้ล่วงหน้าว่ามีบันได 3 จุด
 * ทำให้ตัดสินใจได้ว่าจะไปเส้นทางนี้ไหม หรือจะขอให้คนช่วย
 */
export function ObstacleReport({ report, isScanning, announce }: Props) {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const spoken = useRef<string | null>(null)

  const summary = KIND_ORDER.filter((kind) => report.countsByKind[kind])
    .map((kind) => t(`obstacle.count.${kind}`, { count: report.countsByKind[kind] }))
    .join(' ')

  useEffect(() => {
    if (!announce || isScanning) return
    const key = `${report.failed}|${summary}|${report.obstacles.length}`
    if (spoken.current === key) return
    spoken.current = key

    // ความต่างสำคัญ: "ตรวจไม่ได้" ไม่ใช่ "ไม่มีสิ่งกีดขวาง"
    if (report.failed) speak(t('obstacle.failedSpoken'), { priority: 'critical' })
    else if (summary) speak(t('obstacle.summarySpoken', { summary }), { priority: 'critical' })
    else speak(t('obstacle.noneSpoken'))
  }, [announce, isScanning, report.failed, report.obstacles.length, speak, summary, t])

  const readAloud = () => {
    if (report.failed) {
      speak(t('obstacle.failedSpoken'), { priority: 'critical' })
      return
    }
    if (report.obstacles.length === 0) {
      speak(t('obstacle.noneSpoken'), { priority: 'critical' })
      return
    }
    speak(t('obstacle.summarySpoken', { summary }), { priority: 'critical' })
    for (const obstacle of report.obstacles) {
      speak(
        `${t('obstacle.atDistance', { distance: speakDistance(obstacle.distanceFromStartM) })} ${t(`obstacle.label.${obstacle.kind}`)}`,
      )
    }
  }

  return (
    <section aria-label={t('obstacle.title')} className="obstacle-panel">
      <h2>{t('obstacle.title')}</h2>

      {/*
        ไม่ใส่ aria-live ตรงนี้ เพราะหน้านี้มี live region กลางอยู่แล้วหนึ่งจุด
        ถ้ามีสองจุด screen reader จะอ่านแย่งกันจนผู้ใช้จับใจความไม่ได้
        เนื้อหาสรุปถูกประกาศผ่านเสียงของแอปอยู่แล้ว (ดู useEffect ด้านบน)
      */}
      <p className="status-line">
        {isScanning && t('obstacle.scanning')}
        {!isScanning && report.failed && t('obstacle.failed')}
        {!isScanning && !report.failed && report.obstacles.length === 0 && t('obstacle.none')}
        {!isScanning && !report.failed && summary}
      </p>

      {!isScanning && report.obstacles.length > 0 && (
        <>
          <ul className="obstacle-list">
            {report.obstacles.map((obstacle) => (
              <li
                key={obstacle.id}
                className={obstacle.severity === 'high' ? 'is-high' : undefined}
              >
                <span className="obstacle-distance">
                  {formatDistance(obstacle.distanceFromStartM)}
                </span>
                <span>
                  {t(`obstacle.label.${obstacle.kind}`)}
                  {obstacle.detail?.stepCount
                    ? ` · ${t('obstacle.stepCount', { count: obstacle.detail.stepCount })}`
                    : ''}
                  {obstacle.detail?.incline
                    ? ` · ${t(`obstacle.incline.${obstacle.detail.incline}`)}`
                    : ''}
                  {obstacle.detail?.hasHandrail ? ` · ${t('obstacle.handrail')}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <BigButton variant="secondary" onClick={readAloud}>
            {t('obstacle.readReport')}
          </BigButton>
        </>
      )}

      {/* ข้อจำกัดต้องอยู่ในสายตาเสมอ ไม่ซ่อนไว้ในหน้าตั้งค่า */}
      <p className="disclaimer">{t('obstacle.disclaimer')}</p>
    </section>
  )
}
