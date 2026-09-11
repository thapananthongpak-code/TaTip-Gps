import { useEffect, useRef } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { RouteStep } from '@/types'
import { speakDistance } from '@/utils/format'
import { ARRIVAL_RADIUS_M } from '@/utils/navigation'
import type { UseNavigationResult } from './useNavigation'
import { useSpeech } from './useSpeech'

/**
 * ระยะ (เมตร) ที่ต้องเตือนก่อนถึงจุดเลี้ยว
 * เลือกเกณฑ์ที่ใกล้ที่สุดก่อน ไม่ใช้ GPS ยืนยันว่าต้องเลี้ยวทันที
 */
const ANNOUNCE_AT_METERS = [8, 20, 50, 100] as const

/** สร้างประโยคบอกทางจากขั้นตอนถัดไป */
function instructionFor(t: TFunction, step: RouteStep, distance: number): string {
  const maneuver = t(`maneuver.${step.maneuver}`)
  if (step.maneuver === 'arrive') {
    return t('nav.approaching', { distance: speakDistance(distance), maneuver })
  }
  // แยกคีย์ตามว่ามีชื่อถนนหรือไม่ เพราะโครงประโยคของสองภาษาต่างกัน
  return step.streetName
    ? t('nav.stepInstructionWithStreet', {
        distance: speakDistance(distance),
        maneuver,
        street: step.streetName,
      })
    : t('nav.stepInstruction', { distance: speakDistance(distance), maneuver })
}

/**
 * แปลงความคืบหน้าของการนำทางเป็นเสียงพูด
 *
 * หลักการที่ยึด:
 * - พูดเมื่อ "ข้ามเกณฑ์ระยะ" เท่านั้น ไม่พูดทุกครั้งที่ GPS ขยับ
 * - หนึ่งเกณฑ์ต่อหนึ่งจุดเลี้ยว พูดครั้งเดียว (เก็บใน Set แล้วล้างเมื่อเปลี่ยนขั้นตอน)
 * - เรื่องที่กระทบความปลอดภัย (ออกนอกเส้นทาง / ระบบล่ม / ใกล้ถึงจุดเลี้ยวแล้ว) ใช้ priority critical
 *   เพื่อตัดคิวข้อความที่ไม่เร่งด่วนที่ค้างอยู่
 */
export function useNavigationAnnouncer(nav: UseNavigationResult, enabled: boolean) {
  const { t } = useTranslation()
  const { speak } = useSpeech()

  const announcedRouteIdRef = useRef<string | null>(null)
  const announcedStepRef = useRef(-1)
  const announcedThresholdsRef = useRef(new Set<number>())
  const prevStatusRef = useRef(nav.status)
  const prevErrorRef = useRef<string | null>(null)
  const prevOffRouteRef = useRef(false)
  const prevRetryRef = useRef(0)

  // Resuming or changing language must replay the current instruction.
  useEffect(() => {
    announcedStepRef.current = -1
    announcedThresholdsRef.current.clear()
  }, [enabled, nav.suspended, nav.isRecalculating, nav.isOffRoute, t])

  // 1) เริ่มคำนวณเส้นทาง
  useEffect(() => {
    if (!enabled) return
    if (nav.status === 'calculating' && prevStatusRef.current !== 'calculating') {
      speak(t('nav.calculatingSpoken'))
    }
    prevStatusRef.current = nav.status
  }, [enabled, nav.status, speak, t])

  // 2) ได้เส้นทางใหม่ — สรุปภาพรวมก่อน แล้วค่อยบอกก้าวแรก
  useEffect(() => {
    if (
      !enabled ||
      !nav.route ||
      nav.status !== 'navigating' ||
      nav.suspended ||
      nav.isOffRoute ||
      nav.isRecalculating
    )
      return
    if (announcedRouteIdRef.current === nav.route.id) return

    announcedRouteIdRef.current = nav.route.id
    announcedStepRef.current = -1
    announcedThresholdsRef.current.clear()

    speak(
      t('nav.routeReadySpoken', {
        distance: speakDistance(nav.route.distance),
        minutes: Math.max(1, Math.round(nav.route.duration / 60)),
        destination: nav.route.destination.name,
      }),
    )
  }, [enabled, nav.route, nav.status, nav.suspended, nav.isOffRoute, nav.isRecalculating, speak, t])

  // 3) คำแนะนำแต่ละช่วง + เตือนก่อนถึงจุดเลี้ยว
  useEffect(() => {
    if (
      !enabled ||
      nav.status !== 'navigating' ||
      nav.suspended ||
      nav.isRecalculating ||
      nav.isOffRoute
    )
      return
    const progress = nav.progress
    if (!progress?.nextStep) return

    const { currentStepIndex, nextStep, distanceToNextManeuver } = progress

    // เข้าขั้นตอนใหม่ = บอกภาพรวมของช่วงนี้หนึ่งครั้ง
    if (announcedStepRef.current !== currentStepIndex) {
      announcedStepRef.current = currentStepIndex
      announcedThresholdsRef.current.clear()
      speak(instructionFor(t, nextStep, distanceToNextManeuver), { group: 'navigation' })
      return
    }

    // เตือนตามระยะที่เข้าใกล้ — เลือกเกณฑ์ที่ใกล้ที่สุดที่ยังไม่เคยพูด
    const threshold = ANNOUNCE_AT_METERS.find(
      (m) => distanceToNextManeuver <= m && !announcedThresholdsRef.current.has(m),
    )
    if (threshold === undefined) return

    // เกิน threshold ที่ไกลกว่าไปแล้วโดยไม่ได้พูด (เช่น เพิ่งได้สัญญาณ GPS กลับมา) ก็ถือว่าพูดแล้ว
    for (const m of ANNOUNCE_AT_METERS) {
      if (m >= threshold) announcedThresholdsRef.current.add(m)
    }

    const maneuver = t(`maneuver.${nextStep.maneuver}`)
    speak(
      threshold <= 8
        ? t('nav.maneuverNow', { maneuver })
        : t('nav.approaching', { distance: speakDistance(distanceToNextManeuver), maneuver }),
      { priority: threshold <= 20 ? 'critical' : 'normal', group: 'navigation' },
    )
  }, [
    enabled,
    nav.progress,
    nav.status,
    nav.suspended,
    nav.isRecalculating,
    nav.isOffRoute,
    speak,
    t,
  ])

  // 4) ถึงจุดหมาย
  useEffect(() => {
    if (!enabled) return
    if (nav.status === 'arrived' && nav.destination) {
      const offset = nav.arrivalOffset ?? 0
      speak(
        offset > ARRIVAL_RADIUS_M
          ? t('nav.arrivedNearSpoken', {
              destination: nav.destination.name,
              distance: speakDistance(offset),
            })
          : t('nav.arrivedSpoken', { destination: nav.destination.name }),
        { priority: 'critical' },
      )
    }
  }, [enabled, nav.status, nav.destination, nav.arrivalOffset, speak, t])

  // 5) ออกนอกเส้นทาง
  useEffect(() => {
    if (!enabled) return
    if (nav.isOffRoute && !prevOffRouteRef.current) {
      speak(t('nav.offRouteSpoken'), { priority: 'critical' })
    }
    prevOffRouteRef.current = nav.isOffRoute
  }, [enabled, nav.isOffRoute, speak, t])

  // 6) กำลังลองเรียก API ใหม่ — ผู้ใช้ต้องรู้ตอนที่ระบบสะดุด ไม่ใช่ตอนที่ยอมแพ้แล้ว
  useEffect(() => {
    if (!enabled) return
    if (nav.retryAttempt > 0 && prevRetryRef.current === 0) {
      speak(t('errors.retryingSpoken'), { priority: 'critical' })
    }
    prevRetryRef.current = nav.retryAttempt
  }, [enabled, nav.retryAttempt, speak, t])

  // 7) ล้มเหลวถาวร — ต้องบอกให้หยุดเดินในที่ปลอดภัย ห้ามปล่อยให้เดินต่อโดยไม่รู้
  useEffect(() => {
    if (!enabled) return
    const code = nav.error?.code ?? null
    if (code && code !== prevErrorRef.current) {
      speak(t(`errors.${code}_SPOKEN`), { priority: 'critical' })
    }
    prevErrorRef.current = code
  }, [enabled, nav.error, speak, t])
}
