import { useCallback, useState } from 'react'
import { BigButton } from '@/components/BigButton'
import { GpsStatusPanel } from '@/components/GpsStatusPanel'
import { MapControls } from '@/components/MapControls'
import { MapView } from '@/components/MapView'
import { NavigationPanel } from '@/components/NavigationPanel'
import { PermissionGate } from '@/components/PermissionGate'
import { SearchPanel } from '@/components/SearchPanel'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useGpsAnnouncer } from '@/hooks/useGpsAnnouncer'
import { useNavigation } from '@/hooks/useNavigation'
import { useNavigationAnnouncer } from '@/hooks/useNavigationAnnouncer'
import { useSpeech } from '@/hooks/useSpeech'
import { useWhereAmI } from '@/hooks/useWhereAmI'
import { msg } from '@/i18n/messages'
import type { Place } from '@/types'
import { speakDistance } from '@/utils/format'

/**
 * ตาทิพย์ Navigator
 * Phase 2: ค้นหาจุดหมาย + คำนวณเส้นทางเดินเท้า + นำทาง turn-by-turn ด้วยเสียง
 */
export default function App() {
  const [started, setStarted] = useState(false)
  const [follow, setFollow] = useState(true)

  const geo = useGeolocation()
  const nav = useNavigation(geo.position)
  const whereAmI = useWhereAmI(geo.position)
  const { supported: speechSupported, speak, unlock } = useSpeech()

  useGpsAnnouncer(geo, started)
  useNavigationAnnouncer(nav, started)

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

  const handleSelectPlace = useCallback(
    (place: Place) => {
      setFollow(true)
      nav.start(place)
    },
    [nav],
  )

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

  // พูดคำแนะนำปัจจุบันซ้ำ สำหรับตอนที่ฟังไม่ทันหรือมีเสียงรบกวน
  const handleRepeatInstruction = useCallback(() => {
    const step = nav.progress?.nextStep
    if (!step) {
      speak(msg.nav.calculatingSpoken, { priority: 'critical' })
      return
    }
    speak(
      msg.nav.stepInstruction(
        speakDistance(nav.progress!.distanceToNextManeuver),
        msg.maneuver[step.maneuver],
        step.streetName,
      ),
      { priority: 'critical' },
    )
  }, [nav.progress, speak])

  const isNavigating = nav.status !== 'idle'

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
              route={nav.route}
            />
            <MapControls
              follow={follow}
              onRecenter={handleRecenter}
              disabled={geo.position === null}
            />
          </div>

          <div className="max-h-[55%] overflow-y-auto">
            {isNavigating ? (
              <NavigationPanel nav={nav} onRepeat={handleRepeatInstruction} />
            ) : (
              <SearchPanel position={geo.position} onSelect={handleSelectPlace} />
            )}

            <div className="border-t-2 border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <BigButton
                variant="secondary"
                onClick={whereAmI.announce}
                disabled={whereAmI.isLoading}
                className="w-full"
              >
                {msg.whereAmI.button}
              </BigButton>
              {/* แสดงที่อยู่เต็มไว้ให้อ่าน ส่วนที่พูดออกเสียงเป็นฉบับย่อ */}
              {whereAmI.address && (
                <p aria-live="polite" className="mt-2 text-base text-slate-700 dark:text-slate-200">
                  {whereAmI.address}
                </p>
              )}
            </div>

            <GpsStatusPanel geo={geo} onRepeatStatus={handleRepeatStatus} />
          </div>
        </>
      )}
    </div>
  )
}
