import { useCallback, useEffect, useRef, useState } from 'react'
import { NAVIGATION_ACCURACY_M, routingService, speechService } from '@/services'
import { ServiceError } from '@/types'
import type { ServiceErrorCode } from '@/types'
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
  /**
   * true = ระยะถึงจุดหมายเพิ่มขึ้นต่อเนื่อง แปลว่ากำลังเดินห่างออกไป
   *
   * ต่างจาก isOffRoute อย่างสิ้นเชิงและต้องมีทั้งคู่:
   * isOffRoute ดูว่า "ห่างจากแนวเส้นทางกี่เมตร" ซึ่งจับการหันกลับเดินย้อน
   * บนถนนเส้นเดิมไม่ได้เลย เพราะตอนนั้นยังอยู่บนเส้นทางพอดี ระยะห่างเป็นศูนย์
   * ทดสอบแล้วพบว่าเดินย้อนกลับได้ถึง 450 เมตรโดยที่แอปไม่เคยเอ่ยอะไรเลย
   */
  isMovingAway: boolean
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
  confirmTurn: () => void
  suspended: boolean
}

/** ต้องหลุดติดกันกี่ครั้งถึงจะเชื่อ — กัน GPS แกว่งทำให้คำนวณใหม่มั่ว */
const OFF_ROUTE_STREAK = 2
/**
 * ถ้า GPS แม่นยำแย่กว่านี้ ไม่ตัดสินว่าออกนอกเส้นทาง
 * เพราะจะกลายเป็นยิงคำนวณเส้นทางใหม่รัวๆ ทั้งที่ผู้ใช้เดินถูกทางอยู่
 */
const OFF_ROUTE_MAX_ACCURACY_M = NAVIGATION_ACCURACY_M
/**
 * ต้องเห็นระยะที่เหลือ "เพิ่มขึ้น" ติดกันกี่ครั้งถึงจะเชื่อว่าเดินผิดทาง
 *
 * ต้องมีหลายครั้งเพราะ GPS แกว่งทำให้ระยะขยับขึ้นลงได้เองโดยผู้ใช้ยืนนิ่ง
 */
const AWAY_STREAK = 3
/**
 * ระยะที่เหลือต้องเพิ่มขึ้นรวมกันกี่เมตรถึงจะเชื่อ
 *
 * ตั้งให้ใหญ่กว่าความแกว่งปกติของ GPS ในเมือง แต่เล็กพอที่จะจับได้
 * ก่อนผู้ใช้จะเดินผิดทางไปไกลจนต้องย้อนกลับนาน
 */
const AWAY_DISTANCE_M = 25

/** เว้นระยะระหว่างการคำนวณเส้นทางใหม่ เพื่อไม่ให้ยิง OSRM ถี่เกินไป */
const MIN_RECALC_INTERVAL_MS = 30_000
/**
 * ความแม่นยำแย่สุดที่ยังยอมประกาศว่าถึงจุดหมาย (เมตร)
 *
 * ต้องเท่ากับเกณฑ์ที่ใช้ตัดสินว่า GPS ดีพอจะนำทาง ไม่ใช่เข้มกว่า
 * เดิมตั้งไว้ที่ 15 เมตร ซึ่งเข้มกว่าเกณฑ์นำทาง (30 เมตร) เท่าตัว
 * ผลคือในเมืองที่ความแม่นยำอยู่ราว 20 เมตร ผู้ใช้เดินถึงจุดหมายแล้ว
 * แต่แอปไม่เคยประกาศว่าถึง ไม่ขึ้นปุ่มจบการเดินทาง และย้ำว่า "อีก 10 เมตรถึงจุดหมาย"
 * ไปเรื่อยๆ ทางออกเดียวที่เหลือคือปุ่มสีแดงยกเลิก ทั้งที่เดินทางสำเร็จแล้ว
 *
 * การประกาศช้ากว่าความจริงเล็กน้อยยังพอรับได้ แต่การไม่ประกาศเลยรับไม่ได้
 * และส่วนต่างที่เหลือถูกบอกผ่าน arrivalOffset อยู่แล้วว่ายังต้องหาต่ออีกกี่เมตร
 */
const ARRIVAL_MAX_ACCURACY_M = NAVIGATION_ACCURACY_M

/**
 * จัดการวงจรชีวิตของการนำทาง: ขอเส้นทาง -> ติดตามความคืบหน้า -> ถึงจุดหมาย
 *
 * hook นี้รับผิดชอบ "สถานะและตัวเลข" อย่างเดียว
 * ส่วนการพูดออกเสียงอยู่ที่ useNavigationAnnouncer เพื่อให้แต่ละส่วนเทสต์แยกกันได้
 */
export function useNavigation(
  position: GeoPosition | null,
  usable = true,
  /** ความเร็วเดินจริงของผู้ใช้ ใช้ให้เวลาที่เหลือตรงกับความเป็นจริงมากขึ้น */
  observedPaceMps: number | null = null,
): UseNavigationResult {
  const [status, setStatus] = useState<NavStatus>('idle')
  const [route, setRoute] = useState<Route | null>(null)
  const [destination, setDestination] = useState<Place | null>(null)
  const [progress, setProgress] = useState<NavigationProgress | null>(null)
  const [error, setError] = useState<ServiceError | null>(null)
  const [isOffRoute, setIsOffRoute] = useState(false)
  const [isMovingAway, setIsMovingAway] = useState(false)
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
  const lastProcessedFix = useRef(0)
  // ระยะที่เหลือครั้งล่าสุดที่ "ลดลง" ใช้เป็นฐานวัดว่าหลังจากนั้นเพิ่มขึ้นไปเท่าไร
  const bestRemainingRef = useRef(Infinity)
  const awayStreakRef = useRef(0)
  const [manualStep, setManualStep] = useState(0)

  const calculate = useCallback(async (origin: GeoPosition, place: Place, isRecalc: boolean) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setError(null)
    setProgress(null)
    setRetryAttempt(0)
    lastRecalcAtRef.current = Date.now()
    if (isRecalc) setIsRecalculating(true)
    else setStatus('calculating')

    try {
      const result = await routingService.getWalkingRoute(origin, place, {
        signal: controller.signal,
        onRetry: (attempt) => {
          if (!controller.signal.aborted) setRetryAttempt(attempt)
        },
      })
      if (controller.signal.aborted) return

      stepIndexRef.current = 0
      offRouteStreakRef.current = 0
      bestRemainingRef.current = Infinity
      awayStreakRef.current = 0
      lastRecalcAtRef.current = Date.now()
      setRoute(result)
      setIsMovingAway(false)
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

  /**
   * ตรวจว่าตำแหน่งตอนนี้พร้อมเริ่มนำทางหรือยัง — คืนรหัสสาเหตุเมื่อยังไม่พร้อม
   *
   * เดิมรวมสี่สาเหตุไว้ในเงื่อนไขเดียวแล้วรายงานว่า "ยังไม่ทราบตำแหน่ง" เสมอ
   * ผู้ใช้ที่เห็นแผงสถานะบอกว่ากำลังติดตามตำแหน่งอยู่ที่ ±68 เมตร
   * จึงได้ข้อความที่ขัดกับสิ่งที่เห็นตรงหน้า และไม่รู้ว่าต้องทำอะไรต่อ
   */
  const readiness = useCallback((): ServiceErrorCode | null => {
    const origin = positionRef.current
    if (!origin) return 'NO_POSITION'
    if (origin.accuracy > NAVIGATION_ACCURACY_M) return 'POSITION_TOO_COARSE'
    if (Date.now() - origin.timestamp > 15000) return 'NO_POSITION'
    if (!usable) return 'NO_POSITION'
    return null
  }, [usable])

  const start = useCallback(
    (place: Place) => {
      setDestination(place)
      setProgress(null)
      setArrivalOffset(null)
      const blocked = readiness()
      if (blocked) {
        setError(new ServiceError(blocked))
        setStatus('error')
        return
      }
      void calculate(positionRef.current!, place, false)
    },
    [calculate, readiness],
  )

  const stop = useCallback(() => {
    speechService.cancel()
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
    setRoute(null)
    setDestination(null)
    setProgress(null)
    setError(null)
    setIsOffRoute(false)
    setIsMovingAway(false)
    setIsRecalculating(false)
    setArrivalOffset(null)
    setRetryAttempt(0)
    lastProcessedFix.current = 0
    stepIndexRef.current = 0
    offRouteStreakRef.current = 0
    bestRemainingRef.current = Infinity
    awayStreakRef.current = 0
  }, [])

  /*
   * ลองใหม่ต้องใช้เกณฑ์เดียวกับการเริ่ม และต้องรายงานผลเสมอ
   *
   * เดิมถ้ายังไม่พร้อมจะ return เงียบๆ ปุ่ม "ลองใหม่" จึงกดแล้วไม่เกิดอะไรขึ้นเลย
   * ผู้ใช้ที่มองไม่เห็นจะกดซ้ำไปเรื่อยๆ โดยไม่มีทางรู้ว่าระบบได้ยินหรือเปล่า
   */
  const retry = useCallback(() => {
    if (!destination) return
    const blocked = readiness()
    if (blocked) {
      setError(new ServiceError(blocked))
      setStatus('error')
      return
    }
    void calculate(positionRef.current!, destination, false)
  }, [calculate, destination, readiness])

  // ติดตามความคืบหน้าทุกครั้งที่ GPS อัปเดต
  useEffect(() => {
    if (status !== 'navigating' || !route || !position || !usable || isRecalculating) return
    if (Date.now() - position.timestamp > 15000 || position.accuracy > 30) return

    const result = computeProgress(route, position, stepIndexRef.current, observedPaceMps)
    stepIndexRef.current = result.stepIndex

    setProgress({
      currentStepIndex: result.stepIndex,
      nextStep: result.nextStep,
      distanceToNextManeuver: result.distanceToNextManeuver,
      remainingDistance: result.remainingDistance,
      remainingDuration: result.remainingDuration,
    })

    /*
     * เทียบระยะที่เหลือกับค่าที่ดีที่สุดที่เคยทำได้ ไม่ใช่กับค่าครั้งก่อนหน้า
     *
     * ถ้าเทียบกับครั้งก่อน การเดินผิดทางช้าๆ จะถูกมองเป็นการแกว่งของ GPS ทีละนิด
     * แต่การเทียบกับค่าที่ดีที่สุดทำให้เห็นภาพรวมว่าห่างจากจุดหมายขึ้นเรื่อยๆ จริง
     */
    if (result.remainingDistance < bestRemainingRef.current) {
      bestRemainingRef.current = result.remainingDistance
      awayStreakRef.current = 0
      setIsMovingAway(false)
    } else if (result.remainingDistance > bestRemainingRef.current + AWAY_DISTANCE_M) {
      awayStreakRef.current += 1
      if (awayStreakRef.current >= AWAY_STREAK) setIsMovingAway(true)
    }

    if (result.hasArrived && position.accuracy <= ARRIVAL_MAX_ACCURACY_M) {
      setArrivalOffset(result.distanceToDestination)
      setStatus('arrived')
      setProgress(null)
      return
    }

    // ข้ามการตรวจออกนอกเส้นทางถ้าสัญญาณ GPS ไม่แม่นพอ
    // ไม่งั้นจะกลายเป็นยิงคำนวณเส้นทางใหม่รัวๆ ทั้งที่ผู้ใช้เดินถูกทางอยู่
    if (position.accuracy > OFF_ROUTE_MAX_ACCURACY_M) return

    if (lastProcessedFix.current === position.timestamp) return
    lastProcessedFix.current = position.timestamp
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
  }, [
    position,
    route,
    status,
    destination,
    isRecalculating,
    calculate,
    usable,
    manualStep,
    observedPaceMps,
  ])

  useEffect(() => () => abortRef.current?.abort(), [])

  const confirmTurn = useCallback(() => {
    if (
      status !== 'navigating' ||
      !usable ||
      isOffRoute ||
      isRecalculating ||
      !route ||
      !progress ||
      progress.distanceToNextManeuver > 25
    )
      return
    stepIndexRef.current = Math.min(stepIndexRef.current + 1, route.steps.length - 2)
    speechService.cancel()
    setManualStep((value) => value + 1)
  }, [status, usable, isOffRoute, isRecalculating, route, progress])

  return {
    suspended: !usable,
    confirmTurn,
    status,
    route,
    destination,
    progress: usable && !isRecalculating ? progress : null,
    error,
    isOffRoute,
    isMovingAway,
    isRecalculating,
    arrivalOffset,
    retryAttempt,
    start,
    stop,
    retry,
  }
}
