import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { geocodingService, mapService } from '@/services'
import { ServiceError } from '@/types'
import type { GeoPosition } from '@/types'
import { shortenAddressForSpeech } from '@/utils/format'
import { useSpeech } from './useSpeech'

/**
 * ปุ่ม "ตำแหน่งฉันอยู่ไหน" — ถอดรหัสพิกัดย้อนกลับแล้วพูดที่อยู่ทันที
 *
 * ผลลัพธ์ถูก cache ไว้ที่ชั้น service (ปัดพิกัดเป็นตาราง ~11 เมตร)
 * ผู้ใช้จึงกดซ้ำได้โดยไม่ยิง Nominatim ใหม่ทุกครั้ง
 */
export function useWhereAmI(position: GeoPosition | null) {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const [isLoading, setIsLoading] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [resolvedFor, setResolvedFor] = useState<{
    position: GeoPosition
    language: string
  } | null>(null)
  const latest = useRef(position)
  useEffect(() => {
    latest.current = position
  }, [position])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const announce = useCallback(async () => {
    if (!position || Date.now() - position.timestamp > 15000 || position.accuracy > 30) {
      speak(t('whereAmI.noPositionSpoken'), { priority: 'critical' })
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setAddress(null)
    setIsLoading(true)
    const language = currentLanguage()
    speak(t('whereAmI.lookingUpSpoken'))

    try {
      const place = await geocodingService.reverse(position, {
        signal: controller.signal,
        // ขอที่อยู่เป็นภาษาเดียวกับที่ผู้ใช้เลือกไว้
        language,
      })
      if (controller.signal.aborted) return
      const current = latest.current
      if (
        !current ||
        Date.now() - current.timestamp > 15000 ||
        mapService.distanceBetween(current, position) > 25 ||
        currentLanguage() !== language
      ) {
        speak(t('whereAmI.noPositionSpoken'), { priority: 'critical' })
        return
      }
      if (!place) {
        speak(t('whereAmI.failedSpoken'), { priority: 'critical' })
        setAddress(null)
        return
      }
      setAddress(place.address)
      setResolvedFor({ position, language })
      speak(t('whereAmI.spoken', { address: shortenAddressForSpeech(place.address) }), {
        priority: 'normal',
        group: 'location',
      })
    } catch (err) {
      if (controller.signal.aborted) return
      const code = err instanceof ServiceError ? err.code : 'UNKNOWN'
      if (code === 'ABORTED') return
      speak(t(`errors.${code}_SPOKEN`), { priority: 'critical' })
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [position, speak, t])

  // Caller passes null when GPS is stale; never show an address from a different area/language.
  const addressValid =
    position &&
    resolvedFor &&
    currentLanguage() === resolvedFor.language &&
    mapService.distanceBetween(position, resolvedFor.position) <= 25
  return { announce, isLoading, address: addressValid ? address : null }
}
