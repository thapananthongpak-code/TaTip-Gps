import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSpeech } from './useSpeech'

/**
 * ติดตามสถานะการเชื่อมต่อและแจ้งด้วยเสียงเมื่อเปลี่ยน
 *
 * สำคัญกับแอปนี้เป็นพิเศษ: ตอนออฟไลน์ แผนที่ที่แคชไว้ยังแสดงได้
 * ผู้ใช้ที่มองไม่เห็นจึงไม่มีทางรู้เลยว่าค้นหาและคำนวณเส้นทางใช้ไม่ได้แล้ว
 * ถ้าไม่บอกด้วยเสียง
 */
export function useOnlineStatus(enabled: boolean) {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const wasOnlineRef = useRef(isOnline)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    if (!enabled || wasOnlineRef.current === isOnline) return
    wasOnlineRef.current = isOnline
    speak(isOnline ? t('offline.restoredSpoken') : t('offline.lostSpoken'), {
      priority: 'critical',
    })
  }, [enabled, isOnline, speak, t])

  return isOnline
}
