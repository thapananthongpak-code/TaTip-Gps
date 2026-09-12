import { useCallback, useEffect, useRef, useState } from 'react'
import { currentLanguage } from '@/i18n'
import { NEARBY_RADIUS_M, placesService } from '@/services'
import { ServiceError } from '@/types'
import type { LatLng, Place, PlaceCategory } from '@/types'

export interface UseNearbyPlacesResult {
  /** หมวดที่กำลังแสดงผลอยู่ (null = ยังไม่ได้ค้น) */
  category: PlaceCategory | null
  places: Place[]
  isLoading: boolean
  error: ServiceError | null
  /** true = ค้นสำเร็จแล้วแต่ไม่พบอะไรในรัศมี */
  isEmpty: boolean
  radiusM: number
  find: (category: PlaceCategory) => void
  clear: () => void
}

/**
 * ขยายรัศมีทีละขั้นเองเมื่อไม่เจออะไรเลย
 *
 * จำเป็นเพราะข้อมูล OSM ในไทยนอกใจกลางเมืองบางมาก วัดจริงในรัศมี 800 เมตร:
 * ย่านสยามเจอร้านสะดวกซื้อ 30 แห่ง แต่แถวสายไหมกับบางนาเจอแค่ 5-6 แห่ง
 * และบางหมวด (ร้านขายยา โรงพยาบาล ห้องน้ำ) เจอศูนย์แห่ง
 *
 * เดิมให้ผู้ใช้กดปุ่ม "ขยายรัศมี" เอง ซึ่งแปลว่าต้องเจอหน้าจอ "ไม่พบ" ก่อนถึงจะรู้ว่ามีปุ่มนั้น
 * ตอนนี้ขยายให้เอง แล้วค่อยบอกว่าไม่พบจริงๆ
 *
 * มีแค่สองขั้น ไม่ใช่สาม เพราะคำขอหนึ่งครั้งใช้เวลาหลายวินาที
 * สามขั้นแปลว่าผู้ใช้อาจต้องยืนรอเกินยี่สิบวินาทีกว่าจะรู้ว่าไม่เจอ
 */
const RADIUS_STEPS_M = [NEARBY_RADIUS_M, 2000]

/**
 * ค้นหาสถานที่รอบตัวตามหมวดหมู่
 *
 * ต่างจาก useSearch ตรงที่ไม่ต้องพิมพ์ชื่อ — ผู้ใช้แค่บอกว่าอยากได้ "อะไร"
 * ระบบไปหาว่ารอบตัวมีของแบบนั้นอยู่ตรงไหนบ้าง เรียงจากใกล้ไปไกล
 */
export function useNearbyPlaces(center: LatLng | null): UseNearbyPlacesResult {
  const [category, setCategory] = useState<PlaceCategory | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ServiceError | null>(null)
  const [isEmpty, setIsEmpty] = useState(false)
  const [radiusIndex, setRadiusIndex] = useState(0)

  const controller = useRef<AbortController | null>(null)
  const centerRef = useRef(center)
  useEffect(() => {
    centerRef.current = center
  }, [center])

  const find = useCallback((target: PlaceCategory) => {
    const origin = centerRef.current
    if (!origin) return

    controller.current?.abort()
    const request = new AbortController()
    controller.current = request

    setCategory(target)
    setRadiusIndex(0)
    setIsLoading(true)
    setError(null)
    setIsEmpty(false)
    setPlaces([])

    void (async () => {
      try {
        // ไล่ขยายรัศมีจนกว่าจะเจอ หรือจนสุดขั้นแล้วยังไม่เจอจริงๆ
        for (const [index, radiusM] of RADIUS_STEPS_M.entries()) {
          if (request.signal.aborted) return
          setRadiusIndex(index)

          const found = await placesService.findNearby(target, origin, {
            radiusM,
            language: currentLanguage(),
            signal: request.signal,
          })
          if (request.signal.aborted) return

          if (found.length > 0) {
            setPlaces(found)
            return
          }
        }
        setIsEmpty(true)
      } catch (err) {
        if (request.signal.aborted) return
        setError(err instanceof ServiceError ? err : new ServiceError('UNKNOWN'))
      } finally {
        if (!request.signal.aborted) setIsLoading(false)
      }
    })()
  }, [])

  const clear = useCallback(() => {
    controller.current?.abort()
    setCategory(null)
    setPlaces([])
    setError(null)
    setIsEmpty(false)
    setIsLoading(false)
    setRadiusIndex(0)
  }, [])

  useEffect(() => () => controller.current?.abort(), [])

  return {
    category,
    places,
    isLoading,
    error,
    isEmpty,
    radiusM: RADIUS_STEPS_M[radiusIndex],
    find,
    clear,
  }
}
