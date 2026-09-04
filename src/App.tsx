import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BigButton } from '@/components/BigButton'
import { GpsStatusPanel } from '@/components/GpsStatusPanel'
import { LanguageToggle } from '@/components/LanguageToggle'
import { MapControls } from '@/components/MapControls'
import { MapView } from '@/components/MapView'
import { NavigationPanel } from '@/components/NavigationPanel'
import { PermissionGate } from '@/components/PermissionGate'
import { SafetyPanel } from '@/components/SafetyPanel'
import { SearchPanel } from '@/components/SearchPanel'
import { SharedLocationView } from '@/components/SharedLocationView'
import { useEmergency } from '@/hooks/useEmergency'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useGpsAnnouncer } from '@/hooks/useGpsAnnouncer'
import { useHazardAlerts } from '@/hooks/useHazardAlerts'
import { useLiveShare } from '@/hooks/useLiveShare'
import { useNavigation } from '@/hooks/useNavigation'
import { useNavigationAnnouncer } from '@/hooks/useNavigationAnnouncer'
import { useSettings } from '@/hooks/useSettings'
import { useShareRoute } from '@/hooks/useShareRoute'
import { useSpeech } from '@/hooks/useSpeech'
import { useVoiceAvailability } from '@/hooks/useVoiceAvailability'
import { useWhereAmI } from '@/hooks/useWhereAmI'
import type { Place } from '@/types'
import { speakDistance } from '@/utils/format'
import { vibrate } from '@/utils/vibration'

/** ระยะที่เริ่มสั่นเตือนก่อนถึงจุดเลี้ยว (เมตร) — ตรงกับจังหวะที่เสียงเตือนดัง */
const MANEUVER_VIBRATION_DISTANCE_M = 20

/**
 * ตาทิพย์ Navigator
 * Phase 4: เพิ่มฟีเจอร์ความปลอดภัย — SOS, แชร์ตำแหน่ง, เตือนจุดเสี่ยง, สั่นเตือน
 */
export default function App() {
  const { t } = useTranslation()
  const [started, setStarted] = useState(false)
  const [follow, setFollow] = useState(true)
  const [showSafety, setShowSafety] = useState(false)

  const shareRoute = useShareRoute()
  const settings = useSettings()
  const geo = useGeolocation()
  const nav = useNavigation(geo.position)
  const whereAmI = useWhereAmI(geo.position)
  const { supported: speechSupported, speak, unlock } = useSpeech()

  const emergency = useEmergency({
    position: geo.position,
    vibrationEnabled: settings.settings.vibrationEnabled,
  })
  const liveShare = useLiveShare({
    position: geo.position,
    destination: nav.destination,
    hasArrived: nav.status === 'arrived',
  })

  useVoiceAvailability(started)
  useGpsAnnouncer(geo, started)
  useNavigationAnnouncer(nav, started)
  useHazardAlerts(nav, {
    enabled: started && settings.settings.hazardAlertsEnabled,
    vibrationEnabled: settings.settings.vibrationEnabled,
  })

  // ปุ่มแรกที่ผู้ใช้แตะ ทำสองอย่างพร้อมกัน: ปลดล็อกเสียง (iOS) แล้วค่อยขอสิทธิ์ GPS
  const handleStart = useCallback(() => {
    unlock()
    setStarted(true)
    geo.start()
  }, [geo, unlock])

  const handleRecenter = useCallback(() => {
    setFollow(true)
    speak(t('map.recenterSpoken'))
  }, [speak, t])

  const handleSelectPlace = useCallback(
    (place: Place) => {
      setFollow(true)
      nav.start(place)
    },
    [nav],
  )

  const handleRepeatStatus = useCallback(() => {
    if (geo.error) {
      speak(t(`errors.${geo.error.code}_SPOKEN`), { priority: 'critical' })
      return
    }
    if (!geo.position) {
      speak(t('gps.acquiringSpoken'))
      return
    }
    speak(t('actions.statusSpoken', { meters: Math.round(geo.position.accuracy) }))
  }, [geo.error, geo.position, speak, t])

  // พูดคำแนะนำปัจจุบันซ้ำ สำหรับตอนที่ฟังไม่ทันหรือมีเสียงรบกวน
  const handleRepeatInstruction = useCallback(() => {
    const step = nav.progress?.nextStep
    if (!step) {
      speak(t('nav.calculatingSpoken'), { priority: 'critical' })
      return
    }
    const distance = speakDistance(nav.progress!.distanceToNextManeuver)
    const maneuver = t(`maneuver.${step.maneuver}`)
    speak(
      step.streetName
        ? t('nav.stepInstructionWithStreet', { distance, maneuver, street: step.streetName })
        : t('nav.stepInstruction', { distance, maneuver }),
      { priority: 'critical' },
    )
  }, [nav.progress, speak, t])

  const handleSos = useCallback(
    (contactPhone?: string) => {
      void emergency.trigger(contactPhone)
    },
    [emergency],
  )

  // สั่นเตือนควบคู่กับเสียงเมื่อใกล้ถึงจุดเลี้ยว เผื่ออยู่ในที่เสียงดัง
  // ต้องล็อกไว้ว่าสั่นไปแล้วสำหรับจุดเลี้ยวไหน ไม่งั้นจะสั่นซ้ำทุกครั้งที่ GPS อัปเดต
  // (ประมาณวินาทีละครั้ง) ซึ่งกวนผู้ใช้และกินแบตเตอรี่
  const nextManeuverDistance = nav.progress?.distanceToNextManeuver
  const currentStepIndex = nav.progress?.currentStepIndex
  const vibrationEnabled = settings.settings.vibrationEnabled
  const vibratedStepRef = useRef<number | null>(null)
  useEffect(() => {
    if (!started || nextManeuverDistance === undefined || currentStepIndex === undefined) return
    if (nextManeuverDistance > MANEUVER_VIBRATION_DISTANCE_M) return
    if (vibratedStepRef.current === currentStepIndex) return
    vibratedStepRef.current = currentStepIndex
    vibrate('maneuver', vibrationEnabled)
  }, [started, currentStepIndex, nextManeuverDistance, vibrationEnabled])

  // ผู้รับลิงก์แชร์ตำแหน่งจะเห็นหน้านี้แทนหน้าแอปหลัก
  if (shareRoute.isShareView) {
    return <SharedLocationView payload={shareRoute.payload} />
  }

  const isNavigating = nav.status !== 'idle'

  return (
    <div className="flex h-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="flex items-center justify-between gap-3 bg-brand-600 px-4 py-3 text-white">
        <div>
          <h1 className="text-xl font-bold">{t('app.title')}</h1>
          <p className="text-sm opacity-90">{t('app.subtitle')}</p>
        </div>
        <LanguageToggle />
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
                {t('whereAmI.button')}
              </BigButton>
              <BigButton
                variant="secondary"
                onClick={() => setShowSafety((prev) => !prev)}
                aria-expanded={showSafety}
                aria-controls="safety-panel"
                className="mt-2 w-full"
              >
                {showSafety ? t('settings.closeSettings') : t('settings.openSettings')}
              </BigButton>
              {/* แสดงที่อยู่เต็มไว้ให้อ่าน ส่วนที่พูดออกเสียงเป็นฉบับย่อ */}
              {whereAmI.address && (
                <p aria-live="polite" className="mt-2 text-base text-slate-700 dark:text-slate-200">
                  {whereAmI.address}
                </p>
              )}
            </div>

            {showSafety && (
              <div id="safety-panel">
                <SafetyPanel
                  settings={settings}
                  onSos={handleSos}
                  hasPosition={geo.position !== null}
                  share={{
                    isSharing: liveShare.isSharing,
                    expiresAt: liveShare.session?.expiresAt ?? null,
                    onStart: () => void liveShare.start(),
                    onSendUpdate: () => void liveShare.sendUpdate(),
                    onStop: liveShare.stop,
                  }}
                />
              </div>
            )}

            <GpsStatusPanel geo={geo} onRepeatStatus={handleRepeatStatus} />
          </div>
        </>
      )}
    </div>
  )
}
