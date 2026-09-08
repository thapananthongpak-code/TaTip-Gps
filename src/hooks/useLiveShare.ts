import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { shareService } from '@/services'
import type { GeoPosition, Place, ShareSession } from '@/types'
import { useSpeech } from './useSpeech'

/** อายุของลิงก์แชร์เมื่อไม่ได้กำลังนำทางไปไหน */
const DEFAULT_SHARE_DURATION_MS = 60 * 60 * 1000

interface Options {
  position: GeoPosition | null
  destination: Place | null
  /** true เมื่อถึงจุดหมายแล้ว — ใช้ปิดการแชร์อัตโนมัติ */
  hasArrived: boolean
}

/**
 * แชร์ตำแหน่งให้คนที่ไว้ใจติดตามระหว่างเดินทาง
 *
 * ⚠️ ข้อจำกัดที่ต้องเข้าใจตรงกัน: แอปนี้ไม่มีเซิร์ฟเวอร์ของตัวเอง
 * ลิงก์ที่สร้างจึงเป็น "ภาพนิ่งของตำแหน่ง ณ เวลาที่กดแชร์" ไม่ใช่การติดตามแบบเรียลไทม์
 * ผู้ใช้ต้องกดส่งตำแหน่งล่าสุดซ้ำเพื่ออัปเดต (แอปจะเตือนให้เป็นระยะ)
 * การติดตามแบบเรียลไทม์จริงต้องมีเซิร์ฟเวอร์รับตำแหน่ง ซึ่งจะแลกมาด้วยการที่ตำแหน่งออกจากเครื่อง
 * ดูหัวข้อ "แชร์ตำแหน่ง" ใน README
 *
 * สิ่งที่ทำได้จริงและทำไว้แล้ว:
 * - ข้อมูลตำแหน่งฝังอยู่ใน fragment (#) ของลิงก์ ซึ่งเบราว์เซอร์ไม่ส่งไปยังเซิร์ฟเวอร์
 * - ลิงก์มีวันหมดอายุฝังอยู่ในตัว เปิดหลังหมดอายุจะไม่แสดงตำแหน่ง
 * - ถึงจุดหมายแล้วเซสชันปิดอัตโนมัติตามที่กำหนดไว้
 */
export function useLiveShare({ position, destination, hasArrived }: Options) {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const [session, setSession] = useState<ShareSession | null>(null)
  const arrivalAnnouncedRef = useRef(false)
  const positionRef = useRef(position)
  const generation = useRef(0)

  useEffect(() => {
    generation.current += 1
    return () => {
      generation.current += 1
    }
  }, [hasArrived])

  useEffect(() => {
    positionRef.current = position
  }, [position])

  const buildUrl = useCallback(
    (expiresAt: number) => {
      const current = positionRef.current
      if (!current || Date.now() - current.timestamp > 15000 || current.accuracy > 30) return null
      return shareService.buildShareUrl({
        position: { lat: current.lat, lng: current.lng },
        accuracy: current.accuracy,
        capturedAt: current.timestamp,
        expiresAt,
        destination: destination
          ? { name: destination.name, location: destination.location }
          : undefined,
      })
    },
    [destination],
  )

  /** เริ่มเซสชันแชร์ และส่งตำแหน่งครั้งแรกทันที */
  const start = useCallback(async () => {
    if (!positionRef.current || hasArrived) {
      speak(t('share.noPositionSpoken'), { priority: 'critical' })
      return
    }

    const expiresAt = Date.now() + DEFAULT_SHARE_DURATION_MS
    const url = buildUrl(expiresAt)
    if (!url) return

    arrivalAnnouncedRef.current = false
    const request = ++generation.current
    const outcome = await shareService.share({
      title: t('share.title'),
      text: t('share.messageTemplate', { expires: new Date(expiresAt).toLocaleTimeString() }),
      url,
    })
    if (request !== generation.current || Date.now() >= expiresAt) return
    if (outcome !== 'unavailable')
      setSession({ startedAt: Date.now(), expiresAt, destinationName: destination?.name })
    speak(
      outcome === 'unavailable'
        ? t('share.notSent')
        : outcome === 'copied'
          ? t('share.copiedSpoken')
          : t('share.startedSpoken'),
    )
  }, [buildUrl, destination?.name, hasArrived, speak, t])

  /** ส่งตำแหน่งล่าสุดอีกครั้ง — จำเป็นเพราะลิงก์เป็นภาพนิ่ง ไม่อัปเดตเอง */
  const sendUpdate = useCallback(async () => {
    if (!session || hasArrived || session.expiresAt <= Date.now()) return
    const url = buildUrl(session.expiresAt)
    if (!url) {
      speak(t('share.noPositionSpoken'), { priority: 'critical' })
      return
    }
    const request = generation.current
    const outcome = await shareService.share({
      title: t('share.title'),
      text: t('share.updateMessage'),
      url,
    })
    if (request !== generation.current || session.expiresAt <= Date.now()) return
    speak(
      outcome === 'unavailable'
        ? t('share.notSent')
        : outcome === 'copied'
          ? t('share.copiedSpoken')
          : t('share.updateSentSpoken'),
    )
  }, [buildUrl, session, hasArrived, speak, t])

  const stop = useCallback(() => {
    generation.current += 1
    setSession(null)
    speak(t('share.stoppedSpoken'))
  }, [speak, t])

  /**
   * ถึงจุดหมายแล้วถือว่าเซสชันจบทันที
   * คำนวณจากสถานะปัจจุบันแทนการเก็บเป็น state อีกชุด
   * จะได้ไม่มีทางที่ UI กับข้อมูลจริงจะไม่ตรงกัน
   */
  const activeSession = session !== null && !hasArrived ? session : null

  // ประกาศให้รู้ว่าปิดการแชร์อัตโนมัติแล้ว (พูดอย่างเดียว ไม่แตะ state)
  useEffect(() => {
    if (!hasArrived || session === null) return
    if (!arrivalAnnouncedRef.current) {
      arrivalAnnouncedRef.current = true
      speak(t('share.autoStoppedSpoken'))
    }
    const timer = setTimeout(() => setSession(null), 0)
    return () => clearTimeout(timer)
  }, [hasArrived, session, speak, t])

  // ลิงก์หมดอายุแล้วก็ปิดเซสชันตาม เพื่อไม่ให้ UI บอกว่ายังแชร์อยู่ทั้งที่ลิงก์ใช้ไม่ได้แล้ว
  useEffect(() => {
    if (!session) return
    // ถ้าเวลาหมดไปแล้ว (เช่น เครื่องเพิ่งตื่นจาก sleep) ตั้งเป็น 0 ให้ปิดในรอบถัดไปทันที
    const remaining = Math.max(0, session.expiresAt - Date.now())
    const timer = setTimeout(() => setSession(null), remaining)
    return () => clearTimeout(timer)
  }, [session])

  return {
    session: activeSession,
    start,
    sendUpdate,
    stop,
    isSharing: activeSession !== null,
  }
}
