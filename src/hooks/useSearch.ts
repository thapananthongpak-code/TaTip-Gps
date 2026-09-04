import { useCallback, useEffect, useRef, useState } from 'react'
import { currentLanguage } from '@/i18n'
import { SEARCH_DEBOUNCE_MS, geocodingService } from '@/services'
import { ServiceError } from '@/types'
import type { LatLng, Place } from '@/types'

export interface UseSearchResult {
  query: string
  setQuery: (value: string) => void
  results: Place[]
  isSearching: boolean
  error: ServiceError | null
  /** true เมื่อค้นหาเสร็จแล้วแต่ไม่พบอะไรเลย */
  isEmpty: boolean
  clear: () => void
}

/** ความยาวขั้นต่ำก่อนเริ่มยิงค้นหา — สั้นกว่านี้ผลลัพธ์กว้างเกินจนไม่มีประโยชน์ */
const MIN_QUERY_LENGTH = 2

/**
 * ค้นหาสถานที่แบบหน่วงเวลา
 *
 * Nominatim อนุญาตแค่ 1 คำขอ/วินาที การ debounce ที่นี่คือด่านแรก
 * (ด่านที่สองคือ cache และด่านที่สามคือตัวคุมคิวใน nominatimGeocodingService)
 * ทุกครั้งที่ผู้ใช้พิมพ์ต่อ คำขอเดิมจะถูกยกเลิกทิ้ง ไม่ปล่อยให้ผลลัพธ์เก่ามาทับผลใหม่
 */
export function useSearch(near: LatLng | null): UseSearchResult {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<ServiceError | null>(null)
  const [isEmpty, setIsEmpty] = useState(false)

  // เก็บตำแหน่งไว้ใน ref เพราะ GPS อัปเดตทุกวินาที
  // ถ้าใส่ไว้ใน dependency จะกลายเป็นยิงค้นหาใหม่ทุกครั้งที่ผู้ใช้ขยับ
  const nearRef = useRef(near)
  useEffect(() => {
    nearRef.current = near
  }, [near])

  const abortRef = useRef<AbortController | null>(null)

  const clear = useCallback(() => {
    abortRef.current?.abort()
    setQuery('')
    setResults([])
    setError(null)
    setIsEmpty(false)
    setIsSearching(false)
  }, [])

  /**
   * ล้างผลลัพธ์เก่าทันทีตั้งแต่ตอนพิมพ์ ไม่รอให้ effect ทำให้
   * นอกจากจะตรงกับพฤติกรรมที่ผู้ใช้คาดหวังแล้ว ยังทำให้ effect ด้านล่าง
   * เหลือหน้าที่เดียวคือยิงคำขอตามจังหวะ debounce
   */
  const updateQuery = useCallback((value: string) => {
    setQuery(value)
    if (value.trim().length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort()
      setResults([])
      setError(null)
      setIsEmpty(false)
      setIsSearching(false)
    } else {
      setIsSearching(true)
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) return

    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const found = await geocodingService.search(trimmed, {
          near: nearRef.current ?? undefined,
          signal: controller.signal,
          limit: 5,
          // ขอผลลัพธ์เป็นภาษาเดียวกับที่ผู้ใช้เลือกไว้
          language: currentLanguage(),
        })
        if (controller.signal.aborted) return
        setResults(found)
        setIsEmpty(found.length === 0)
        setError(null)
      } catch (err) {
        if (controller.signal.aborted) return
        const serviceError =
          err instanceof ServiceError ? err : new ServiceError('UNKNOWN', String(err))
        if (serviceError.code === 'ABORTED') return
        setError(serviceError)
        setResults([])
        setIsEmpty(false)
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => () => abortRef.current?.abort(), [])

  return { query, setQuery: updateQuery, results, isSearching, error, isEmpty, clear }
}
