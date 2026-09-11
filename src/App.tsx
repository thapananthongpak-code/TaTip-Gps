import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Announcer } from '@/components/Announcer'
import { AppearancePanel } from '@/components/AppearancePanel'
import { BigButton } from '@/components/BigButton'
import { EmergencyDialog } from '@/components/EmergencyDialog'
import { GpsStatusPanel } from '@/components/GpsStatusPanel'
import { LanguageToggle } from '@/components/LanguageToggle'
import { MapView } from '@/components/MapView'
import { NavigationPanel } from '@/components/NavigationPanel'
import { NearbyPlaces } from '@/components/NearbyPlaces'
import { ObstacleReport } from '@/components/ObstacleReport'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PermissionGate } from '@/components/PermissionGate'
import { SafetyPanel } from '@/components/SafetyPanel'
import { SearchPanel } from '@/components/SearchPanel'
import { SharedLocationView } from '@/components/SharedLocationView'
import { SosButton } from '@/components/SosButton'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { useAppearance } from '@/hooks/useAppearance'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useGpsAnnouncer } from '@/hooks/useGpsAnnouncer'
import { useHazardAlerts } from '@/hooks/useHazardAlerts'
import { useLiveShare } from '@/hooks/useLiveShare'
import { useNavigation } from '@/hooks/useNavigation'
import { useNavigationAnnouncer } from '@/hooks/useNavigationAnnouncer'
import { useNearbyPlaces } from '@/hooks/useNearbyPlaces'
import { useObstacleAlerts } from '@/hooks/useObstacleAlerts'
import { useObstacleScan } from '@/hooks/useObstacleScan'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSettings } from '@/hooks/useSettings'
import { useShareRoute } from '@/hooks/useShareRoute'
import { useSpeech } from '@/hooks/useSpeech'
import { useWhereAmI } from '@/hooks/useWhereAmI'
import { speechService } from '@/services'
import type { Place } from '@/types'
import { speakDistance } from '@/utils/format'
import { vibrate } from '@/utils/vibration'

export default function App() {
  const { t } = useTranslation()
  const [started, setStarted] = useState(false)
  // แผนที่แสดงตั้งแต่แรก ไม่ซ่อนไว้หลังปุ่ม เพราะผู้ใช้สายตาเลือนรางและคนที่ช่วยเหลือ
  // ใช้แผนที่เพื่อยืนยันว่าระบบเข้าใจตำแหน่งถูกต้องหรือไม่
  const [showMap, setShowMap] = useState(true)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [visible, setVisible] = useState(() => !document.hidden)
  const [follow, setFollow] = useState(true)
  const settings = useSettings()
  const shareRoute = useShareRoute()
  const geo = useGeolocation()
  const { speak } = useSpeech()
  const online = useOnlineStatus(started)
  useAppearance(settings.settings)
  useEffect(() => {
    const change = () => {
      setVisible(!document.hidden)
      setNow(Date.now())
      speechService.cancel()
    }
    document.addEventListener('visibilitychange', change)
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      document.removeEventListener('visibilitychange', change)
      clearInterval(timer)
    }
  }, [])
  const gpsUsable =
    !!geo.position &&
    !geo.error &&
    !geo.isStale &&
    geo.position.accuracy <= 30 &&
    now - geo.position.timestamp <= 15000
  const usable = gpsUsable && visible && !emergencyOpen
  const nav = useNavigation(geo.position, usable)
  const active = nav.status !== 'idle' && nav.status !== 'arrived'
  const where = useWhereAmI(gpsUsable ? geo.position : null)
  const nearby = useNearbyPlaces(gpsUsable ? geo.position : null)
  const obstacleScan = useObstacleScan(nav.route, started)
  const share = useLiveShare({
    position: gpsUsable ? geo.position : null,
    destination: nav.destination,
    hasArrived: nav.status === 'arrived',
  })
  const wasPaused = useRef(false)
  const wasBlocked = useRef(false)
  useEffect(() => {
    const paused = active && !usable
    const blocked = paused || nav.isOffRoute || nav.isRecalculating || nav.status === 'error'
    if (blocked && !wasBlocked.current) speechService.cancel()
    if (paused !== wasPaused.current) {
      if (paused || (active && !blocked))
        speak(t(paused ? 'nav.paused' : 'nav.resumed'), { priority: 'critical' })
    }
    wasPaused.current = paused
    wasBlocked.current = blocked
  }, [active, usable, nav.isOffRoute, nav.isRecalculating, nav.status, speak, t])
  useGpsAnnouncer(geo, started && !active)
  useNavigationAnnouncer(nav, started)
  // คำเตือนจุดเสี่ยงและสิ่งกีดขวางเปิดเสมอ ไม่ทำเป็นตัวเลือกให้ปิด
  // เพราะเป็นข้อมูลความปลอดภัย และการซ่อนไว้หลังสวิตช์ทำให้ผู้ใช้ใหม่ไม่รู้ว่ามี
  useHazardAlerts(nav, { enabled: started })
  useObstacleAlerts(nav, obstacleScan.report.obstacles, nav.route, {
    enabled: started && usable,
  })
  const vibrated = useRef('')
  useEffect(() => {
    if (
      nav.status !== 'navigating' ||
      !usable ||
      !nav.progress ||
      nav.progress.distanceToNextManeuver > 20
    )
      return
    const key = nav.route?.id + ':' + nav.progress.currentStepIndex
    if (key === vibrated.current) return
    vibrated.current = key
    vibrate('maneuver')
  }, [nav.status, nav.progress, nav.route?.id, usable])

  const repeat = useCallback(() => {
    speechService.cancel()
    if (active && !usable) {
      speak(t('nav.paused'), { priority: 'critical' })
      return
    }
    if (nav.status === 'error') {
      speak(t(`errors.${nav.error?.code ?? 'UNKNOWN'}_SPOKEN`), { priority: 'critical' })
      return
    }
    if (nav.isOffRoute || nav.isRecalculating) {
      speak(t('nav.offRouteSpoken'), { priority: 'critical' })
      return
    }
    if (nav.status === 'arrived') {
      speak(
        t('nav.arrivedNearSpoken', {
          destination: nav.destination?.name,
          distance: speakDistance(nav.arrivalOffset ?? 0),
        }),
      )
      return
    }
    const step = nav.progress?.nextStep
    if (step && nav.progress) {
      speak(
        t(step.streetName ? 'nav.stepInstructionWithStreet' : 'nav.stepInstruction', {
          distance: speakDistance(nav.progress.distanceToNextManeuver),
          maneuver: t('maneuver.' + step.maneuver),
          street: step.streetName,
        }),
        { group: 'navigation', priority: 'critical' },
      )
    } else speak(t(active ? 'nav.calculatingSpoken' : 'gps.acquiringSpoken'))
  }, [
    active,
    usable,
    nav.status,
    nav.error,
    nav.isOffRoute,
    nav.isRecalculating,
    nav.destination,
    nav.arrivalOffset,
    nav.progress,
    speak,
    t,
  ])

  const chooseDestination = useCallback(
    (place: Place) => {
      speechService.cancel()
      nearby.clear()
      nav.start(place)
      requestAnimationFrame(() => document.getElementById('navigation-panel')?.focus())
    },
    [nav, nearby],
  )

  /**
   * ปุ่มเดียวตอบคำถามเดียวที่ผู้ใช้ถามจริงๆ ว่า "ตอนนี้ฉันอยู่ไหน"
   *
   * เดิมแยกเป็นสองปุ่มคนละที่: ปุ่มบอกที่อยู่ กับปุ่มบอกความแม่นยำ
   * ซึ่งผู้ใช้ต้องจำว่าปุ่มไหนให้อะไร ทั้งที่ทั้งสองอย่างควรได้ยินพร้อมกันอยู่แล้ว
   * เพราะที่อยู่จะเชื่อถือได้แค่ไหนขึ้นกับความแม่นยำในขณะนั้น
   */
  const announceLocation = useCallback(() => {
    if (!gpsUsable) {
      speak(t('nav.paused'), { priority: 'critical' })
      return
    }
    speak(t('actions.statusSpoken', { meters: Math.round(geo.position!.accuracy) }), {
      priority: 'critical',
    })
    void where.announce()
  }, [gpsUsable, geo.position, speak, t, where])

  const openEmergency = () => {
    speechService.cancel()
    setEmergencyOpen(true)
  }
  const stopNavigation = () => {
    nav.stop()
    speak(t('nav.stoppedSpoken'), { priority: 'critical' })
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
    )
  }
  if (shareRoute.isShareView) return <SharedLocationView payload={shareRoute.payload} />

  return (
    <div className="app-shell">
      <a
        href="#main-controls"
        className="skip-link"
        onClick={() => document.getElementById('main-controls')?.focus()}
      >
        {t('a11y.skipToMain')}
      </a>
      <header className="app-header">
        <div>
          <h1 className="text-2xl font-bold">{t('app.title')}</h1>
          <p>{t('app.subtitle')}</p>
        </div>
        <LanguageToggle />
      </header>
      <UpdatePrompt busy={active} />
      {!online && <OfflineBanner />}
      <Announcer />
      <main id="main-controls" tabIndex={-1}>
        <div className="emergency-access">
          <SosButton onTrigger={openEmergency} />
        </div>
        {started && (
          <section className="primary-controls" aria-label={t('a11y.mainLabel')}>
            {nav.status === 'idle' ? (
              <SearchPanel position={geo.position} onSelect={chooseDestination} isOnline={online} />
            ) : (
              <NavigationPanel nav={{ ...nav, stop: stopNavigation }} onRepeat={repeat} />
            )}
            {nav.status === 'idle' && (
              <NearbyPlaces
                nearby={nearby}
                position={gpsUsable ? geo.position : null}
                onSelect={chooseDestination}
                isOnline={online}
              />
            )}
            <BigButton variant="secondary" onClick={announceLocation} disabled={where.isLoading}>
              {t('whereAmI.button')}
            </BigButton>
            {where.address && <p>{where.address}</p>}
            {nav.route && (
              <ObstacleReport
                report={obstacleScan.report}
                isScanning={obstacleScan.isScanning}
                announce={started}
              />
            )}
            <GpsStatusPanel geo={geo} />
          </section>
        )}
        {started && (
          <>
            <BigButton
              variant="secondary"
              aria-expanded={showMap}
              aria-controls="visual-map"
              onClick={() => setShowMap((value) => !value)}
            >
              {t(showMap ? 'map.hide' : 'map.show')}
            </BigButton>
            <div id="visual-map" hidden={!showMap}>
              {showMap && (
                <>
                  <div className="map-frame">
                    <MapView
                      position={geo.position}
                      isPoorAccuracy={geo.isPoorAccuracy}
                      isStale={geo.isStale}
                      follow={follow}
                      onUserPan={() => setFollow(false)}
                      route={nav.route}
                      results={nav.status === 'idle' ? nearby.places : []}
                      obstacles={obstacleScan.report.obstacles}
                      onSelectResult={chooseDestination}
                    />
                  </div>
                  <BigButton variant="secondary" onClick={() => setFollow(true)}>
                    {t('map.recenter')}
                  </BigButton>
                </>
              )}
            </div>
          </>
        )}
        {!started && (
          <PermissionGate
            onStart={() => {
              speak(t('gps.acquiringSpoken'))
              setStarted(true)
              geo.start()
            }}
          />
        )}
        {/* ตั้งค่าทั้งหมดอยู่ในที่เดียว ผู้ใช้ไม่ต้องเดาว่าของที่ต้องการอยู่กล่องไหน */}
        <details className="settings-section">
          <summary>{t('settings.openSettings')}</summary>
          <SafetyPanel
            settings={settings}
            onSos={openEmergency}
            hasPosition={gpsUsable}
            share={{
              isSharing: share.isSharing,
              expiresAt: share.session?.expiresAt ?? null,
              onStart: () => void share.start(),
              onSendUpdate: () => void share.sendUpdate(),
              onStop: share.stop,
            }}
          />
          <AppearancePanel settings={settings} />
        </details>
        <p className="safety-note">{t('nav.safetyNote')}</p>
        <footer>
          <a
            className="inline-flex min-h-touch items-center underline"
            href="https://www.openstreetmap.org/copyright"
          >
            © OpenStreetMap contributors
          </a>
          <p>Routing: FOSSGIS / OSRM</p>
        </footer>
      </main>
      {emergencyOpen && (
        <EmergencyDialog
          contacts={settings.settings.emergencyContacts}
          position={geo.position}
          onClose={() => setEmergencyOpen(false)}
        />
      )}
    </div>
  )
}
