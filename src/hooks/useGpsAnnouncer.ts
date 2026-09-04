import { useEffect, useRef } from 'react'
import { msg } from '@/i18n/messages'
import type { UseGeolocationResult } from './useGeolocation'
import { useSpeech } from './useSpeech'

/** กันพูดเรื่องสัญญาณอ่อนซ้ำถี่เกินไปจนรบกวนผู้ใช้ */
const POOR_ACCURACY_REPEAT_MS = 60_000

/**
 * แปลงการเปลี่ยนสถานะ GPS เป็นเสียงพูด
 *
 * แยกออกมาจาก useGeolocation เพราะ hook นั้นควรรู้แค่เรื่องตำแหน่ง
 * ส่วนการตัดสินใจว่า "ต้องพูดอะไร เมื่อไหร่ ซ้ำได้แค่ไหน" เป็นคนละความรับผิดชอบ
 *
 * กติกา: พูดเฉพาะตอน "เปลี่ยนสถานะ" เท่านั้น ไม่พูดซ้ำทุก tick ของ watchPosition
 */
export function useGpsAnnouncer(geo: UseGeolocationResult, enabled: boolean) {
  const { speak } = useSpeech()

  const prevStatus = useRef(geo.status)
  const prevErrorCode = useRef<string | null>(null)
  const prevPoor = useRef(false)
  const prevStale = useRef(false)
  const lastPoorSpokenAt = useRef(0)
  const hasAnnouncedFirstFix = useRef(false)

  useEffect(() => {
    if (!enabled) return

    // 1) เริ่มค้นหาตำแหน่ง
    if (geo.status === 'acquiring' && prevStatus.current !== 'acquiring') {
      speak(msg.gps.acquiringSpoken)
    }

    // 2) ได้ตำแหน่งแรก
    if (geo.status === 'tracking' && !hasAnnouncedFirstFix.current && geo.position) {
      hasAnnouncedFirstFix.current = true
      speak(msg.gps.foundSpoken)
    }
    if (geo.status === 'idle') hasAnnouncedFirstFix.current = false

    prevStatus.current = geo.status
  }, [enabled, geo.status, geo.position, speak])

  // 3) ข้อผิดพลาด — สำคัญที่สุด ต้องตัดคิวพูดทันที ไม่ปล่อยให้ผู้ใช้เดินต่อโดยไม่รู้ว่าระบบหยุด
  useEffect(() => {
    if (!enabled) return
    const code = geo.error?.code ?? null
    if (code && code !== prevErrorCode.current) {
      speak(msg.errors[`${code}_SPOKEN`], { priority: 'critical' })
    }
    prevErrorCode.current = code
  }, [enabled, geo.error, speak])

  // 4) ความแม่นยำต่ำ / กลับมาแม่นยำ
  useEffect(() => {
    if (!enabled || !geo.position) return
    const now = Date.now()

    if (geo.isPoorAccuracy) {
      const isNew = !prevPoor.current
      const canRepeat = now - lastPoorSpokenAt.current > POOR_ACCURACY_REPEAT_MS
      if (isNew || canRepeat) {
        lastPoorSpokenAt.current = now
        speak(msg.gps.poorAccuracySpoken(Math.round(geo.position.accuracy)), {
          priority: 'critical',
        })
      }
    } else if (prevPoor.current) {
      speak(msg.gps.recoveredSpoken)
    }

    prevPoor.current = geo.isPoorAccuracy
  }, [enabled, geo.isPoorAccuracy, geo.position, speak])

  // 5) สัญญาณขาดหายกลางทาง (ตำแหน่งค้าง) — เตือนว่าที่เห็นอยู่อาจเป็นตำแหน่งเก่า
  useEffect(() => {
    if (!enabled) return
    if (geo.isStale && !prevStale.current && geo.status !== 'idle') {
      speak(msg.gps.staleSpoken, { priority: 'critical' })
    }
    prevStale.current = geo.isStale
  }, [enabled, geo.isStale, geo.status, speak])
}
