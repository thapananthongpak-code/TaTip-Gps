import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { vibrate } from '@/utils/vibration'
import type { UseNavigationResult } from './useNavigation'
import { useSpeech } from './useSpeech'

/**
 * ระยะที่เริ่มเตือนจุดเสี่ยง (เมตร)
 *
 * ตั้งไว้ไกลกว่าคำเตือนจุดเลี้ยว (20 ม.) ตั้งใจให้ได้ยินคำว่า "ระวังสี่แยก"
 * ก่อนคำสั่งเลี้ยว ผู้ใช้จะได้ชะลอฝีเท้าก่อนถึงจุดที่ต้องตัดสินใจ
 */
const HAZARD_WARNING_DISTANCE_M = 35

interface Options {
  enabled: boolean
  vibrationEnabled: boolean
}

/**
 * เตือนจุดเสี่ยงบนเส้นทางด้วยเสียงและการสั่น
 *
 * จุดเสี่ยงมาจาก route steps ของ OSRM (สี่แยก หรือถนนใหญ่ที่มีชื่อ)
 * เตือนหนึ่งครั้งต่อหนึ่งจุด ไม่พูดซ้ำระหว่างเดินเข้าใกล้
 *
 * ⚠️ ข้อจำกัดที่ต้องบอกผู้ใช้: ข้อมูลฟรีของ OSRM ไม่ได้ระบุว่ามีทางม้าลายหรือสัญญาณไฟจริงหรือไม่
 * คำเตือนนี้จึงเป็นการให้ "ระวังไว้ก่อน" ไม่ใช่การยืนยันว่าปลอดภัยที่จะข้าม
 */
export function useHazardAlerts(nav: UseNavigationResult, options: Options) {
  const { enabled, vibrationEnabled } = options
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const warnedStepRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || nav.status !== 'navigating') return

    const progress = nav.progress
    if (!progress) return
    const step = progress.nextStep
    if (!step?.hazard) return
    if (progress.distanceToNextManeuver > HAZARD_WARNING_DISTANCE_M) return

    // กันเตือนซ้ำจุดเดิม — ใช้ id ของเส้นทางร่วมด้วย เผื่อคำนวณเส้นทางใหม่แล้วเจอจุดเดิม
    const key = `${nav.route?.id ?? ''}:${step.id}`
    if (warnedStepRef.current === key) return
    warnedStepRef.current = key

    vibrate('hazard', vibrationEnabled)
    speak(
      step.hazard === 'crossroads'
        ? t('hazard.crossroadsSpoken')
        : t('hazard.majorRoadSpoken', { street: step.streetName ?? '' }),
      { priority: 'critical' },
    )
  }, [enabled, nav.progress, nav.route?.id, nav.status, speak, t, vibrationEnabled])

  // เริ่มเส้นทางใหม่ = ล้างความจำว่าเคยเตือนจุดไหนไปแล้ว
  useEffect(() => {
    warnedStepRef.current = null
  }, [nav.route?.id])
}
