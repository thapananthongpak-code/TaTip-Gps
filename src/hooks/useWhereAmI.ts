import { useCallback, useRef, useState } from 'react'
import { msg } from '@/i18n/messages'
import { geocodingService } from '@/services'
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
  const { speak } = useSpeech()
  const [isLoading, setIsLoading] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const announce = useCallback(async () => {
    if (!position) {
      speak(msg.whereAmI.noPositionSpoken, { priority: 'critical' })
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    speak(msg.whereAmI.lookingUpSpoken)

    try {
      const place = await geocodingService.reverse(position, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (!place) {
        speak(msg.whereAmI.failedSpoken, { priority: 'critical' })
        setAddress(null)
        return
      }
      setAddress(place.address)
      speak(msg.whereAmI.spoken(shortenAddressForSpeech(place.address)), { priority: 'critical' })
    } catch (err) {
      if (controller.signal.aborted) return
      const code = err instanceof ServiceError ? err.code : 'UNKNOWN'
      if (code === 'ABORTED') return
      speak(msg.errors[`${code}_SPOKEN`], { priority: 'critical' })
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [position, speak])

  return { announce, isLoading, address }
}
