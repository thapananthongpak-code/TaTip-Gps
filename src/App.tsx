import { useCallback, useState } from 'react'
import { GpsStatusPanel } from '@/components/GpsStatusPanel'
import { MapControls } from '@/components/MapControls'
import { MapView } from '@/components/MapView'
import { PermissionGate } from '@/components/PermissionGate'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useGpsAnnouncer } from '@/hooks/useGpsAnnouncer'
import { useSpeech } from '@/hooks/useSpeech'
import { msg } from '@/i18n/messages'

/**
 * ตาทิพย์ Navigator
 * Phase 1: แผนที่ + ติดตามตำแหน่ง GPS แบบเรียลไทม์ + แจ้งทุกสถานะด้วยเสียง
 */
export default function App() {
  const [started, setStarted] = useState(false)
  const [follow, setFollow] = useState(true)

  const geo = useGeolocation()
  const { supported: speechSupported, speak, unlock } = useSpeech()

  useGpsAnnouncer(geo, started)

  // ปุ่มแรกที่ผู้ใช้แตะ ทำสองอย่างพร้อมกัน: ปลดล็อกเสียง (iOS) แล้วค่อยขอสิทธิ์ GPS
  const handleStart = useCallback(() => {
    unlock()
    setStarted(true)
    geo.start()
  }, [geo, unlock])

  const handleRecenter = useCallback(() => {
    setFollow(true)
    speak(msg.map.recenterSpoken)
  }, [speak])

  const handleRepeatStatus = useCallback(() => {
    if (geo.error) {
      speak(msg.errors[`${geo.error.code}_SPOKEN`], { priority: 'critical' })
      return
    }
    if (!geo.position) {
      speak(msg.gps.acquiringSpoken)
      return
    }
    speak(msg.actions.statusSpoken(Math.round(geo.position.accuracy)))
  }, [geo.error, geo.position, speak])

  return (
    <div className="flex h-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="bg-brand-600 px-4 py-3 text-white">
        <h1 className="text-xl font-bold">{msg.app.title}</h1>
        <p className="text-sm opacity-90">{msg.app.subtitle}</p>
      </header>

      {!started ? (
        <PermissionGate onStart={handleStart} speechSupported={speechSupported} />
      ) : (
        <>
          <div className="relative flex-1">
            <MapView
              position={geo.position}
              isPoorAccuracy={geo.isPoorAccuracy}
              isStale={geo.isStale}
              follow={follow}
              onUserPan={() => setFollow(false)}
            />
            <MapControls
              follow={follow}
              onRecenter={handleRecenter}
              disabled={geo.position === null}
            />
          </div>
          <GpsStatusPanel geo={geo} onRepeatStatus={handleRepeatStatus} />
        </>
      )}
    </div>
  )
}
