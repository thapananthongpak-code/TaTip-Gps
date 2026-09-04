import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { shareService } from '@/services'
import type { GeoPosition } from '@/types'
import { vibrate } from '@/utils/vibration'
import { useSpeech } from './useSpeech'

export type EmergencyOutcome = 'sent' | 'copied' | 'no-contact' | 'no-position' | 'failed'

interface Options {
  position: GeoPosition | null
  vibrationEnabled: boolean
}

/**
 * ส่งสัญญาณขอความช่วยเหลือฉุกเฉิน
 *
 * ลำดับการทำงานเมื่อถูกเรียก:
 * 1. ไม่มีตำแหน่ง -> บอกด้วยเสียงทันที ไม่ส่งข้อความเปล่าที่ไม่มีประโยชน์
 * 2. มีผู้ติดต่อฉุกเฉิน -> เปิดแอปส่งข้อความพร้อมข้อความและลิงก์แผนที่ที่เตรียมไว้ให้แล้ว
 * 3. ไม่มีผู้ติดต่อ -> ใช้แผงแชร์ของระบบ หรือคัดลอกข้อความลงคลิปบอร์ดเป็นทางสุดท้าย
 *
 * แอปไม่ส่งข้อความเอง เพราะเบราว์เซอร์ทำไม่ได้และไม่ควรทำ —
 * ผู้ใช้ต้องเห็นและกดส่งเองในแอปข้อความ ซึ่งเป็นการยืนยันอีกชั้นก่อนข้อมูลจะออกจากเครื่อง
 */
export function useEmergency({ position, vibrationEnabled }: Options) {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  const buildMessage = useCallback(
    (pos: GeoPosition) => {
      const mapUrl = shareService.buildMapUrl(pos.lat, pos.lng)
      return t('sos.messageTemplate', {
        latitude: pos.lat.toFixed(6),
        longitude: pos.lng.toFixed(6),
        accuracy: Math.round(pos.accuracy),
        time: new Date(pos.timestamp).toLocaleTimeString(),
        url: mapUrl,
      })
    },
    [t],
  )

  const trigger = useCallback(
    async (contactPhone?: string): Promise<EmergencyOutcome> => {
      if (!position) {
        speak(t('sos.noPositionSpoken'), { priority: 'critical' })
        return 'no-position'
      }

      const message = buildMessage(position)
      setLastMessage(message)
      vibrate('sos', vibrationEnabled)

      if (contactPhone) {
        speak(t('sos.sendingSpoken'), { priority: 'critical' })
        shareService.openSms(contactPhone, message)
        return 'sent'
      }

      const outcome = await shareService.share({
        title: t('sos.shareTitle'),
        text: message,
        url: shareService.buildMapUrl(position.lat, position.lng),
      })

      if (outcome === 'shared') {
        speak(t('sos.sendingSpoken'), { priority: 'critical' })
        return 'sent'
      }
      if (outcome === 'copied') {
        speak(t('sos.copiedSpoken'), { priority: 'critical' })
        return 'copied'
      }

      speak(t('sos.noContactSpoken'), { priority: 'critical' })
      return 'no-contact'
    },
    [buildMessage, position, speak, t, vibrationEnabled],
  )

  return { trigger, lastMessage }
}
