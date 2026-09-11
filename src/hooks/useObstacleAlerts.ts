import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { OBSTACLE_WARNING_DISTANCE_M } from '@/services'
import type { Obstacle, Route } from '@/types'
import { speakDistance } from '@/utils/format'
import { vibrate } from '@/utils/vibration'
import type { UseNavigationResult } from './useNavigation'
import { useSpeech } from './useSpeech'

interface Options {
  enabled: boolean
}

/** ประโยคเตือนของสิ่งกีดขวางแต่ละชนิด พร้อมรายละเอียดที่ช่วยเตรียมตัวได้จริง */
function describe(
  obstacle: Obstacle,
  t: ReturnType<typeof useTranslation>['t'],
  distanceAhead: number,
): string {
  const distance = speakDistance(Math.max(0, distanceAhead))
  const detail = obstacle.detail

  if (obstacle.kind === 'steps') {
    // บอกขึ้น/ลง จำนวนขั้น และราวจับ เพราะเป็นสามสิ่งที่ต้องรู้ก่อนเท้าแตะขั้นแรก
    const direction = detail?.incline ? t(`obstacle.incline.${detail.incline}`) : ''
    const count = detail?.stepCount ? t('obstacle.stepCount', { count: detail.stepCount }) : ''
    const handrail = detail?.hasHandrail ? t('obstacle.handrail') : ''
    return t('obstacle.stepsSpoken', { distance, direction, count, handrail })
      .replace(/\s+/g, ' ')
      .trim()
  }

  return t(`obstacle.${obstacle.kind}Spoken`, { distance })
}

/**
 * เตือนด้วยเสียงเมื่อกำลังเดินเข้าใกล้สิ่งกีดขวางบนเส้นทาง
 *
 * ใช้ระยะที่เดินมาแล้ว (ความยาวเส้นทาง ลบ ระยะที่เหลือ) เทียบกับตำแหน่งของสิ่งกีดขวางบนเส้นทาง
 * จึงรู้ว่า "อีกกี่เมตรจะถึง" โดยไม่ต้องคำนวณเส้นตรงจากพิกัด ซึ่งจะผิดเมื่อทางเลี้ยวไปมา
 *
 * เตือนเฉพาะชนิดที่ทำให้บาดเจ็บได้ทันที (บันได เขตก่อสร้าง)
 * ส่วนเสากั้นและขอบทางอยู่ในรายงานก่อนออกเดินทางเท่านั้น
 * ถ้าเตือนทุกอย่างระหว่างเดิน เสียงจะถี่จนกลบคำสั่งนำทางที่สำคัญกว่า
 */
export function useObstacleAlerts(
  nav: UseNavigationResult,
  obstacles: Obstacle[],
  route: Route | null,
  { enabled }: Options,
) {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const warned = useRef(new Set<string>())

  // เส้นทางใหม่ = เริ่มนับใหม่ว่าเคยเตือนจุดไหนไปแล้ว
  const routeId = route?.id ?? null
  useEffect(() => {
    warned.current = new Set()
  }, [routeId])

  useEffect(() => {
    if (!enabled || nav.status !== 'navigating' || !route || !nav.progress) return

    const travelled = route.distance - nav.progress.remainingDistance

    for (const obstacle of obstacles) {
      if (obstacle.severity !== 'high') continue
      if (warned.current.has(obstacle.id)) continue

      const ahead = obstacle.distanceFromStartM - travelled
      // เดินผ่านไปแล้วก็ไม่ต้องเตือน แต่ทำเครื่องหมายไว้กันเตือนย้อนหลังตอน GPS แกว่ง
      if (ahead < 0) {
        warned.current.add(obstacle.id)
        continue
      }
      if (ahead > OBSTACLE_WARNING_DISTANCE_M) continue

      warned.current.add(obstacle.id)
      vibrate('hazard')
      speak(describe(obstacle, t, ahead), { priority: 'critical' })
    }
  }, [enabled, nav.status, nav.progress, obstacles, route, speak, t])
}
