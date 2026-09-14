import { useCallback, useEffect, useRef, useState } from 'react'
import { GPS_POOR_ACCURACY_M } from '@/services'
import type { GeoError, GeoPosition } from '@/types'

export type GeoStatus =
  /** ยังไม่เริ่ม — รอผู้ใช้กดปุ่มอนุญาต */
  | 'idle'
  /** ขอสิทธิ์/กำลังรอตำแหน่งแรก */
  | 'acquiring'
  /** ได้ตำแหน่งแล้วและกำลังติดตามต่อเนื่อง */
  | 'tracking'
  /** ผิดพลาดจนใช้งานไม่ได้ */
  | 'error'

interface UseGeolocationOptions {
  /** ความแม่นยำที่แย่กว่านี้ (เมตร) ถือว่าเชื่อถือไม่ได้ */
  poorAccuracyThreshold?: number
  /** ถ้าไม่ได้ตำแหน่งใหม่เกินเวลานี้ (ms) ถือว่าสัญญาณขาดหาย */
  staleAfterMs?: number
  /** เวลารอตำแหน่งแรกก่อนถือว่า timeout (ms) */
  timeoutMs?: number
}

/**
 * เก็บประวัติตำแหน่งไว้กี่จุด
 *
 * พอสำหรับ 5 นาทีที่ GPS อัปเดตทุกวินาที ซึ่งยาวพอจะวัดความเร็วเดินเฉลี่ยได้นิ่ง
 * และสั้นพอที่จะไม่กินหน่วยความจำระหว่างเดินทางไกล
 */
const HISTORY_SIZE = 300

export interface UseGeolocationResult {
  status: GeoStatus
  position: GeoPosition | null
  /**
   * ตำแหน่งล่าสุดเรียงตามเวลา สำหรับคำนวณความเร็วและการหยุดนิ่ง
   *
   * เก็บที่นี่เพราะเป็นที่เดียวที่ตำแหน่งใหม่เข้ามา และเข้ามาผ่าน callback
   * ของเบราว์เซอร์ ไม่ใช่ผ่าน effect จึงอัปเดตสถานะได้ตรงไปตรงมา
   * ส่วนการแปลงประวัติเป็นความเร็วเป็นฟังก์ชันบริสุทธิ์ที่อยู่แยกต่างหาก
   */
  history: GeoPosition[]
  error: GeoError | null
  /** true เมื่อ accuracy แย่กว่าเกณฑ์ */
  isPoorAccuracy: boolean
  /** true เมื่อไม่ได้รับตำแหน่งใหม่นานผิดปกติ (สัญญาณหายระหว่างเดิน) */
  isStale: boolean
  /** เริ่มติดตาม — ต้องเรียกจาก user gesture เพื่อให้ iOS ยอมทั้ง GPS และเสียง */
  start: () => void
  stop: () => void
  /** ลองใหม่หลังเกิดข้อผิดพลาด */
  retry: () => void
}

/** Initial acquisition and freshness have independent deadlines. */
export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationResult {
  const {
    poorAccuracyThreshold = GPS_POOR_ACCURACY_M,
    staleAfterMs = 15000,
    timeoutMs = 15000,
  } = options
  const [status, setStatus] = useState<GeoStatus>('idle')
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [history, setHistory] = useState<GeoPosition[]>([])
  const [error, setError] = useState<GeoError | null>(null)
  const [isStale, setIsStale] = useState(false)
  const watch = useRef<number | null>(null)
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cleanup = useCallback(() => {
    generation.current++
    clearTimeout(timer.current)
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current)
    watch.current = null
  }, [])
  const stop = useCallback(() => {
    cleanup()
    setStatus('idle')
    setPosition(null)
    setHistory([])
    setError(null)
    setIsStale(false)
  }, [cleanup])
  const start = useCallback(() => {
    cleanup()
    const id = generation.current
    setError(null)
    setPosition(null)
    setHistory([])
    setIsStale(false)
    if (!window.isSecureContext) {
      setError({ code: 'INSECURE_CONTEXT' })
      setStatus('error')
      return
    }
    if (!navigator.geolocation) {
      setError({ code: 'UNSUPPORTED' })
      setStatus('error')
      return
    }
    setStatus('acquiring')
    timer.current = setTimeout(() => {
      if (id !== generation.current) return
      setError({ code: 'TIMEOUT' })
      setStatus('error')
      setIsStale(true)
    }, timeoutMs)
    try {
      watch.current = navigator.geolocation.watchPosition(
        (fix) => {
          if (id !== generation.current) return
          const { latitude: lat, longitude: lng, accuracy, heading, speed } = fix.coords
          if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            Math.abs(lat) > 90 ||
            Math.abs(lng) > 180 ||
            !Number.isFinite(accuracy) ||
            accuracy < 0 ||
            !Number.isFinite(fix.timestamp) ||
            fix.timestamp > Date.now() + 5000
          ) {
            setError({ code: 'POSITION_UNAVAILABLE' })
            setIsStale(true)
            return
          }
          const next: GeoPosition = { lat, lng, accuracy, heading, speed, timestamp: fix.timestamp }
          setPosition(next)
          // ตำแหน่งเดิมที่ส่งซ้ำไม่ใช่ข้อมูลใหม่ ถ้านับด้วยจะทำให้ดูเหมือนหยุดนิ่ง
          setHistory((prev) =>
            prev[prev.length - 1]?.timestamp === next.timestamp
              ? prev
              : [...prev, next].slice(-HISTORY_SIZE),
          )
          setError(null)
          setStatus('tracking')
          const age = Date.now() - fix.timestamp
          setIsStale(age >= staleAfterMs)
          clearTimeout(timer.current)
          timer.current = setTimeout(
            () => {
              if (id === generation.current) setIsStale(true)
            },
            Math.max(0, staleAfterMs - age),
          )
        },
        (failure) => {
          if (id !== generation.current) return
          const code =
            failure.code === 1
              ? 'PERMISSION_DENIED'
              : failure.code === 3
                ? 'TIMEOUT'
                : 'POSITION_UNAVAILABLE'
          setError({ code })
          setIsStale(true)
          setStatus('error')
          if (code === 'PERMISSION_DENIED') cleanup()
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
      )
    } catch {
      cleanup()
      setError({ code: 'POSITION_UNAVAILABLE' })
      setStatus('error')
    }
  }, [cleanup, staleAfterMs, timeoutMs])
  useEffect(() => cleanup, [cleanup])
  return {
    status,
    position,
    history,
    error,
    isStale,
    isPoorAccuracy: !!position && position.accuracy > poorAccuracyThreshold,
    start,
    stop,
    retry: start,
  }
}
