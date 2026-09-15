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
    /*
     * เวลารอตำแหน่งแรกก่อนยอมแพ้
     *
     * GPS ที่เพิ่งเปิดเครื่องหรือเพิ่งย้ายที่ ("cold start") ใช้เวลา 30-60 วินาที
     * แม้อยู่กลางแจ้ง ค่าเดิม 15 วินาทีจึงสั้นเกินไปจนขึ้นว่าหาไม่พบ
     * ทั้งที่ถ้ารออีกหน่อยก็ได้
     */
    timeoutMs = 45000,
  } = options
  const [status, setStatus] = useState<GeoStatus>('idle')
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [history, setHistory] = useState<GeoPosition[]>([])
  const [error, setError] = useState<GeoError | null>(null)
  const [isStale, setIsStale] = useState(false)
  const watch = useRef<number | null>(null)
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // รู้ว่าได้ตำแหน่งแล้วหรือยัง โดยไม่ต้องรอ setState ซึ่งเป็น async
  const hasFix = useRef(false)
  const cleanup = useCallback(() => {
    generation.current++
    hasFix.current = false
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

    /** รับตำแหน่งหนึ่งจุด ตรวจความถูกต้อง แล้วบันทึก — ใช้ร่วมกันทั้งสองทาง */
    const accept = (fix: GeolocationPosition) => {
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
      hasFix.current = true
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
    }

    /*
     * ขอตำแหน่งคร่าวๆ ให้ได้ก่อนหนึ่งจุด แล้วค่อยตามด้วยตำแหน่งที่แม่นยำ
     *
     * enableHighAccuracy: false บอกให้เครื่องใช้ WiFi และเสาสัญญาณช่วยเดาได้
     * ซึ่งเป็นวิธีเดียวที่ได้ผลเมื่ออยู่ในอาคาร เพราะสัญญาณดาวเทียมถูกหลังคาบังเกือบหมด
     * ตอบกลับภายในไม่กี่วินาที แทนที่จะรอดาวเทียมจนหมดเวลาแล้วขึ้นว่าหาไม่พบ
     *
     * ⚠️ ตำแหน่งคร่าวๆ นี้คลาดได้ถึงหลักร้อยเมตร ใช้แค่แสดงบนแผนที่และจัดอันดับ
     * ผลค้นหาเท่านั้น ส่วนการนำทางยังต้องผ่านเกณฑ์ความแม่นยำเดิมทุกประการ
     */
    try {
      navigator.geolocation.getCurrentPosition(
        (fix) => {
          // ทิ้งไปถ้าได้ตำแหน่งที่แม่นยำกว่ามาก่อนแล้ว ห้ามเขียนทับของที่ดีกว่า
          if (id !== generation.current || hasFix.current) return
          accept(fix)
        },
        () => {
          // ไม่ตั้ง error เพราะตัวติดตามหลักยังพยายามอยู่ นี่เป็นแค่ทางลัด
        },
        { enableHighAccuracy: false, maximumAge: 10000, timeout: 12000 },
      )
    } catch {
      // เบราว์เซอร์บางตัวโยน error ตรงนี้ได้ ปล่อยให้ตัวติดตามหลักทำงานต่อ
    }

    try {
      watch.current = navigator.geolocation.watchPosition(
        accept,
        (failure) => {
          if (id !== generation.current) return
          const code =
            failure.code === 1
              ? 'PERMISSION_DENIED'
              : failure.code === 3
                ? 'TIMEOUT'
                : 'POSITION_UNAVAILABLE'
          /*
           * ถ้าได้ตำแหน่งคร่าวๆ มาแล้ว การที่ดาวเทียมยังจับไม่ได้ไม่ใช่ความล้มเหลว
           * ยังมีตำแหน่งให้ใช้อยู่ แค่ยังไม่แม่นพอจะนำทาง ซึ่งแผงสถานะบอกอยู่แล้ว
           */
          if (hasFix.current && code !== 'PERMISSION_DENIED') return
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
