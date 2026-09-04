import { useEffect, useRef } from 'react'
import { msg } from '@/i18n/messages'
import type { RouteStep } from '@/types'
import { speakDistance } from '@/utils/format'
import { ARRIVAL_RADIUS_M } from '@/utils/navigation'
import type { UseNavigationResult } from './useNavigation'
import { useSpeech } from './useSpeech'

/**
 * ระยะ (เมตร) ที่ต้องเตือนก่อนถึงจุดเลี้ยว
 * เรียงจากไกลไปใกล้ พูดครั้งเดียวต่อหนึ่งจุดเลี้ยว
 * 8 เมตรคือจังหวะ "ทำเดี๋ยวนี้" ซึ่งสำหรับคนเดินคือประมาณ 6-7 ก้าว
 */
const ANNOUNCE_AT_METERS = [100, 50, 20, 8] as const

/** สร้างประโยคบอกทางจากขั้นตอนถัดไป */
function instructionFor(step: RouteStep, distance: number): string {
  const maneuverText = msg.maneuver[step.maneuver]
  if (step.maneuver === 'arrive') {
    return msg.nav.approaching(speakDistance(distance), msg.maneuver.arrive)
  }
  return msg.nav.stepInstruction(speakDistance(distance), maneuverText, step.streetName)
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
  const { speak } = useSpeech()

  const announcedRouteIdRef = useRef<string | null>(null)
  const announcedStepRef = useRef(-1)
  const announcedThresholdsRef = useRef(new Set<number>())
  const prevStatusRef = useRef(nav.status)
  const prevErrorRef = useRef<string | null>(null)
  const prevOffRouteRef = useRef(false)
  const prevRetryRef = useRef(0)

  // 1) เริ่มคำนวณเส้นทาง
  useEffect(() => {
    if (!enabled) return
    if (nav.status === 'calculating' && prevStatusRef.current !== 'calculating') {
      speak(msg.nav.calculatingSpoken)
    }
    prevStatusRef.current = nav.status
  }, [enabled, nav.status, speak])

  // 2) ได้เส้นทางใหม่ — สรุปภาพรวมก่อน แล้วค่อยบอกก้าวแรก
  useEffect(() => {
    if (!enabled || !nav.route || nav.status !== 'navigating') return
    if (announcedRouteIdRef.current === nav.route.id) return

    announcedRouteIdRef.current = nav.route.id
    announcedStepRef.current = -1
    announcedThresholdsRef.current.clear()

    speak(
      msg.nav.routeReadySpoken(
        speakDistance(nav.route.distance),
        Math.max(1, Math.round(nav.route.duration / 60)),
        nav.route.destination.name,
      ),
    )

    // เส้นทางจากบริการสำรองเป็นเส้นทางรถ ต้องเตือนก่อนที่ผู้ใช้จะก้าวออกไป
    if (nav.route.usedFallbackProfile) {
      speak(msg.nav.fallbackWarningSpoken, { priority: 'normal' })
    }
  }, [enabled, nav.route, nav.status, speak])

  // 3) คำแนะนำแต่ละช่วง + เตือนก่อนถึงจุดเลี้ยว
  useEffect(() => {
    if (!enabled || nav.status !== 'navigating') return
    const progress = nav.progress
    if (!progress?.nextStep) return

    const { currentStepIndex, nextStep, distanceToNextManeuver } = progress

    // เข้าขั้นตอนใหม่ = บอกภาพรวมของช่วงนี้หนึ่งครั้ง
    if (announcedStepRef.current !== currentStepIndex) {
      announcedStepRef.current = currentStepIndex
      announcedThresholdsRef.current.clear()
      speak(instructionFor(nextStep, distanceToNextManeuver))
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

    const maneuverText = msg.maneuver[nextStep.maneuver]
    speak(
      threshold <= 8
        ? msg.nav.maneuverNow(maneuverText)
        : msg.nav.approaching(speakDistance(distanceToNextManeuver), maneuverText),
      { priority: threshold <= 20 ? 'critical' : 'normal' },
    )
  }, [enabled, nav.progress, nav.status, speak])

  // 4) ถึงจุดหมาย
  useEffect(() => {
    if (!enabled) return
    if (nav.status === 'arrived' && nav.destination) {
      const offset = nav.arrivalOffset ?? 0
      speak(
        offset > ARRIVAL_RADIUS_M
          ? msg.nav.arrivedNearSpoken(nav.destination.name, speakDistance(offset))
          : msg.nav.arrivedSpoken(nav.destination.name),
        { priority: 'critical' },
      )
    }
  }, [enabled, nav.status, nav.destination, nav.arrivalOffset, speak])

  // 5) ออกนอกเส้นทาง
  useEffect(() => {
    if (!enabled) return
    if (nav.isOffRoute && !prevOffRouteRef.current) {
      speak(msg.nav.offRouteSpoken, { priority: 'critical' })
    }
    prevOffRouteRef.current = nav.isOffRoute
  }, [enabled, nav.isOffRoute, speak])

  // 6) กำลังลองเรียก API ใหม่ — ผู้ใช้ต้องรู้ตอนที่ระบบสะดุด ไม่ใช่ตอนที่ยอมแพ้แล้ว
  useEffect(() => {
    if (!enabled) return
    if (nav.retryAttempt > 0 && prevRetryRef.current === 0) {
      speak(msg.errors.retryingSpoken, { priority: 'critical' })
    }
    prevRetryRef.current = nav.retryAttempt
  }, [enabled, nav.retryAttempt, speak])

  // 7) ล้มเหลวถาวร — ต้องบอกให้หยุดเดินในที่ปลอดภัย ห้ามปล่อยให้เดินต่อโดยไม่รู้
  useEffect(() => {
    if (!enabled) return
    const code = nav.error?.code ?? null
    if (code && code !== prevErrorRef.current) {
      speak(msg.errors[`${code}_SPOKEN`], { priority: 'critical' })
    }
    prevErrorRef.current = code
  }, [enabled, nav.error, speak])
}
