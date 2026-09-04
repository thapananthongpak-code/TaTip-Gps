import { useCallback, useEffect, useRef, useState } from 'react'
import { routingService } from '@/services'
import { ServiceError } from '@/types'
import type { GeoPosition, Place, Route, RouteStep } from '@/types'
import { OFF_ROUTE_M, computeProgress } from '@/utils/navigation'

export type NavStatus = 'idle' | 'calculating' | 'navigating' | 'arrived' | 'error'

export interface NavigationProgress {
  /** ขั้นตอนที่ผู้ใช้กำลังเดินอยู่ */
  currentStepIndex: number
  /** จุดเลี้ยวถัดไปที่ต้องเตือน */
  nextStep: RouteStep | null
  /** ระยะจากตำแหน่งปัจจุบันถึงจุดเลี้ยวถัดไป (เมตร) */
  distanceToNextManeuver: number
  remainingDistance: number
  remainingDuration: number
}

export interface UseNavigationResult {
  status: NavStatus
  route: Route | null
  destination: Place | null
  progress: NavigationProgress | null
  error: ServiceError | null
  isOffRoute: boolean
  isRecalculating: boolean
  /**
   * ระยะจากจุดที่ประกาศว่าถึงแล้ว ไปยังพิกัดจุดหมายจริง (เมตร)
   * ใช้บอกผู้ใช้ว่ายังต้องเดินหาต่ออีกไกลแค่ไหน เมื่อเส้นทางจบก่อนถึงตัวอาคาร
   */
  arrivalOffset: number | null
  /** จำนวนครั้งที่กำลังลองเรียก API ใหม่ (0 = ปกติ) */
  retryAttempt: number
  start: (place: Place) => void
  stop: () => void
  retry: () => void
}

/** ต้องหลุดติดกันกี่ครั้งถึงจะเชื่อ — กัน GPS แกว่งทำให้คำนวณใหม่มั่ว */
const OFF_ROUTE_STREAK = 2
/**
 * ถ้า GPS แม่นยำแย่กว่านี้ ไม่ตัดสินว่าออกนอกเส้นทาง
 * เพราะจะกลายเป็นยิงคำนวณเส้นทางใหม่รัวๆ ทั้งที่ผู้ใช้เดินถูกทางอยู่
 */
const OFF_ROUTE_MAX_ACCURACY_M = 30
/** เว้นระยะระหว่างการคำนวณเส้นทางใหม่ เพื่อไม่ให้ยิง OSRM ถี่เกินไป */
const MIN_RECALC_INTERVAL_MS = 30_000

/**
 * จัดการวงจรชีวิตของการนำทาง: ขอเส้นทาง -> ติดตามความคืบหน้า -> ถึงจุดหมาย
 *
 * hook นี้รับผิดชอบ "สถานะและตัวเลข" อย่างเดียว
 * ส่วนการพูดออกเสียงอยู่ที่ useNavigationAnnouncer เพื่อให้แต่ละส่วนเทสต์แยกกันได้
 */
export function useNavigation(position: GeoPosition | null): UseNavigationResult {
  const [status, setStatus] = useState<NavStatus>('idle')
  const [route, setRoute] = useState<Route | null>(null)
  const [destination, setDestination] = useState<Place | null>(null)
  const [progress, setProgress] = useState<NavigationProgress | null>(null)
  const [error, setError] = useState<ServiceError | null>(null)
  const [isOffRoute, setIsOffRoute] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [arrivalOffset, setArrivalOffset] = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  // เก็บตำแหน่งล่าสุดไว้ให้ event handler อ่านได้ โดยไม่ต้องผูกเป็น dependency ของ callback
  const positionRef = useRef(position)
  useEffect(() => {
    positionRef.current = position
  }, [position])
  const stepIndexRef = useRef(0)
  const offRouteStreakRef = useRef(0)
  const lastRecalcAtRef = useRef(0)

  const calculate = useCallback(async (origin: GeoPosition, place: Place, isRecalc: boolean) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setError(null)
    setRetryAttempt(0)
    if (isRecalc) setIsRecalculating(true)
    else setStatus('calculating')

    try {
      const result = await routingService.getWalkingRoute(origin, place, {
        signal: controller.signal,
        onRetry: (attempt) => setRetryAttempt(attempt),
      })
      if (controller.signal.aborted) return

      stepIndexRef.current = 0
      offRouteStreakRef.current = 0
      lastRecalcAtRef.current = Date.now()
      setRoute(result)
      setIsOffRoute(false)
      setStatus('navigating')
    } catch (err) {
      if (controller.signal.aborted) return
      const serviceError =
        err instanceof ServiceError ? err : new ServiceError('UNKNOWN', String(err))
      if (serviceError.code === 'ABORTED') return
      setError(serviceError)
      setStatus('error')
    } finally {
      if (!controller.signal.aborted) {
        setIsRecalculating(false)
        setRetryAttempt(0)
      }
    }
  }, [])

  const start = useCallback(
    (place: Place) => {
      setDestination(place)
      setProgress(null)
      setArrivalOffset(null)
      const origin = positionRef.current
      if (!origin) {
        setError(new ServiceError('NO_POSITION'))
        setStatus('error')
        return
      }
      void calculate(origin, place, false)
    },
    [calculate],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
    setRoute(null)
    setDestination(null)
    setProgress(null)
    setError(null)
    setIsOffRoute(false)
    setIsRecalculating(false)
    setArrivalOffset(null)
    stepIndexRef.current = 0
    offRouteStreakRef.current = 0
  }, [])

  const retry = useCallback(() => {
    const origin = positionRef.current
    if (!origin || !destination) return
    void calculate(origin, destination, false)
  }, [calculate, destination])

  // ติดตามความคืบหน้าทุกครั้งที่ GPS อัปเดต
  useEffect(() => {
    if (status !== 'navigating' || !route || !position) return

    const result = computeProgress(route, position, stepIndexRef.current)
    stepIndexRef.current = result.stepIndex

    setProgress({
      currentStepIndex: result.stepIndex,
      nextStep: result.nextStep,
      distanceToNextManeuver: result.distanceToNextManeuver,
      remainingDistance: result.remainingDistance,
      remainingDuration: result.remainingDuration,
    })

    if (result.hasArrived) {
      setArrivalOffset(result.distanceToDestination)
      setStatus('arrived')
      setProgress(null)
      return
    }

    // ข้ามการตรวจออกนอกเส้นทางถ้าสัญญาณ GPS ไม่แม่นพอ
    // ไม่งั้นจะกลายเป็นยิงคำนวณเส้นทางใหม่รัวๆ ทั้งที่ผู้ใช้เดินถูกทางอยู่
    if (position.accuracy > OFF_ROUTE_MAX_ACCURACY_M) return

    if (result.deviation > OFF_ROUTE_M) {
      offRouteStreakRef.current += 1
      if (offRouteStreakRef.current >= OFF_ROUTE_STREAK) {
        setIsOffRoute(true)
        const canRecalc = Date.now() - lastRecalcAtRef.current > MIN_RECALC_INTERVAL_MS
        if (canRecalc && destination && !isRecalculating) {
          void calculate(position, destination, true)
        }
      }
    } else {
      offRouteStreakRef.current = 0
      setIsOffRoute(false)
    }
  }, [position, route, status, destination, isRecalculating, calculate])

  useEffect(() => () => abortRef.current?.abort(), [])

  return {
    status,
    route,
    destination,
    progress,
    error,
    isOffRoute,
    isRecalculating,
    arrivalOffset,
    retryAttempt,
    start,
    stop,
    retry,
  }
}
