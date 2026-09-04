import { useCallback, useEffect, useRef, useState } from 'react'
import { GPS_POOR_ACCURACY_M } from '@/services'
import type { GeoError, GeoErrorCode, GeoPosition } from '@/types'

export type GeoStatus =
  /** ยังไม่เริ่ม — รอผู้ใช้กดปุ่มอนุญาต */
  | 'idle'
  /** ขอสิทธิ์/กำลังรอตำแหน่งแรก */
  | 'acquiring'
  /** ได้ตำแหน่งแล้วและกำลังติดตามต่อเนื่อง */
  | 'tracking'
  /** ผิดพลาดจนใช้งานไม่ได้ */
  | 'error'

export interface UseGeolocationOptions {
  /** ความแม่นยำที่แย่กว่านี้ (เมตร) ถือว่าเชื่อถือไม่ได้ */
  poorAccuracyThreshold?: number
  /** ถ้าไม่ได้ตำแหน่งใหม่เกินเวลานี้ (ms) ถือว่าสัญญาณขาดหาย */
  staleAfterMs?: number
  /** เวลารอตำแหน่งแรกก่อนถือว่า timeout (ms) */
  timeoutMs?: number
}

export interface UseGeolocationResult {
  status: GeoStatus
  position: GeoPosition | null
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

const DEFAULT_STALE_MS = 20_000
const DEFAULT_TIMEOUT_MS = 15_000

/** แปลงรหัสข้อผิดพลาดของเบราว์เซอร์เป็นรหัสกลางของแอป */
function toGeoErrorCode(err: GeolocationPositionError): GeoErrorCode {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'PERMISSION_DENIED'
    case err.TIMEOUT:
      return 'TIMEOUT'
    default:
      return 'POSITION_UNAVAILABLE'
  }
}

/**
 * ติดตามตำแหน่งแบบ real-time ด้วย watchPosition
 *
 * ครอบเคสที่ผู้ใช้ตาบอดจะเดือดร้อนถ้าไม่จัดการ:
 * - ปฏิเสธสิทธิ์ -> คืน error PERMISSION_DENIED ให้ชั้นบนพูดบอกและมีปุ่มลองใหม่
 * - อยู่ในตึก/อับสัญญาณ -> POSITION_UNAVAILABLE โดยยังไม่หยุด watch เผื่อสัญญาณกลับมาเอง
 * - หาตำแหน่งแรกนานเกินไป -> TIMEOUT
 * - เคยได้ตำแหน่งแล้วสัญญาณหายกลางทาง -> isStale (watchPosition บางแพลตฟอร์มเงียบไปเฉยๆ ไม่ยิง error)
 * - ความแม่นยำแย่ -> isPoorAccuracy
 */
export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationResult {
  const {
    poorAccuracyThreshold = GPS_POOR_ACCURACY_M,
    staleAfterMs = DEFAULT_STALE_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options

  const [status, setStatus] = useState<GeoStatus>('idle')
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError] = useState<GeoError | null>(null)
  const [isStale, setIsStale] = useState(false)

  const watchIdRef = useRef<number | null>(null)
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearStaleTimer = useCallback(() => {
    if (staleTimerRef.current !== null) {
      clearTimeout(staleTimerRef.current)
      staleTimerRef.current = null
    }
  }, [])

  const armStaleTimer = useCallback(() => {
    clearStaleTimer()
    staleTimerRef.current = setTimeout(() => setIsStale(true), staleAfterMs)
  }, [clearStaleTimer, staleAfterMs])

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    clearStaleTimer()
    setIsStale(false)
    setStatus('idle')
  }, [clearStaleTimer])

  const start = useCallback(() => {
    // ตรวจข้อจำกัดของสภาพแวดล้อมก่อน จะได้บอกผู้ใช้ตรงสาเหตุ ไม่ใช่ปล่อยให้ timeout ไปเฉยๆ
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError({ code: 'UNSUPPORTED' })
      setStatus('error')
      return
    }
    if (!window.isSecureContext) {
      setError({ code: 'INSECURE_CONTEXT' })
      setStatus('error')
      return
    }
    if (watchIdRef.current !== null) return

    setError(null)
    setIsStale(false)
    setStatus('acquiring')

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
          timestamp: pos.timestamp,
        })
        setError(null)
        setIsStale(false)
        setStatus('tracking')
        armStaleTimer()
      },
      (err) => {
        const code = toGeoErrorCode(err)
        setError({ code, raw: err.message })

        // ถูกปฏิเสธสิทธิ์ = จบ ไม่ต้อง watch ต่อให้เปลืองแบต
        if (code === 'PERMISSION_DENIED') {
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
          }
          clearStaleTimer()
          setStatus('error')
          return
        }

        // สัญญาณหายชั่วคราว: ถ้าเคยได้ตำแหน่งแล้วให้คงโหมดติดตามไว้ เผื่อสัญญาณกลับมาเอง
        setStatus((prev) => (prev === 'tracking' ? 'tracking' : 'error'))
        setIsStale(true)
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    )
  }, [armStaleTimer, clearStaleTimer, timeoutMs])

  const retry = useCallback(() => {
    stop()
    // ให้ state รอบก่อนเคลียร์ก่อนค่อยเริ่มใหม่
    queueMicrotask(start)
  }, [start, stop])

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (staleTimerRef.current !== null) clearTimeout(staleTimerRef.current)
    }
  }, [])

  const isPoorAccuracy = position !== null && position.accuracy > poorAccuracyThreshold

  return { status, position, error, isPoorAccuracy, isStale, start, stop, retry }
}
