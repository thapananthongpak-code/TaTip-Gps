import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Announcer } from '@/components/Announcer'
import { AppearancePanel } from '@/components/AppearancePanel'
import { BigButton } from '@/components/BigButton'
import { GpsStatusPanel } from '@/components/GpsStatusPanel'
import { LanguageToggle } from '@/components/LanguageToggle'
import { MapView } from '@/components/MapView'
import { NavigationPanel } from '@/components/NavigationPanel'
import { NearbyPlaces } from '@/components/NearbyPlaces'
import { ObstacleReport } from '@/components/ObstacleReport'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PermissionGate } from '@/components/PermissionGate'
import { SearchPanel } from '@/components/SearchPanel'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { useAppearance } from '@/hooks/useAppearance'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useGpsAnnouncer } from '@/hooks/useGpsAnnouncer'
import { useHazardAlerts } from '@/hooks/useHazardAlerts'
import { useNavigation } from '@/hooks/useNavigation'
import { useNavigationAnnouncer } from '@/hooks/useNavigationAnnouncer'
import { useNearbyPlaces } from '@/hooks/useNearbyPlaces'
import { useObstacleAlerts } from '@/hooks/useObstacleAlerts'
import { useObstacleScan } from '@/hooks/useObstacleScan'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSettings } from '@/hooks/useSettings'
import { useSpeech } from '@/hooks/useSpeech'
import { useWhereAmI } from '@/hooks/useWhereAmI'
import { speechService } from '@/services'
import type { Place } from '@/types'
import { speakDistance } from '@/utils/format'
import { vibrate } from '@/utils/vibration'

/** ระยะที่เริ่มสั่นเตือนก่อนถึงจุดเลี้ยว (เมตร) — ตรงกับจังหวะที่เสียงเตือนดัง */
const MANEUVER_VIBRATION_DISTANCE_M = 20

/** GPS ที่แม่นยำแย่กว่านี้ (เมตร) เชื่อถือไม่ได้พอจะใช้นำทาง */
const NAVIGATION_ACCURACY_M = 30

/** ตำแหน่งที่เก่ากว่านี้ (มิลลิวินาที) ถือว่าค้าง */
const POSITION_STALE_MS = 15_000

/**
 * ตาทิพย์ Navigator
 *
 * โฟกัสสองอย่าง: ค้นหาสถานที่ให้เจอ และนำทางด้วยเสียงให้ถูกต้อง
 * ทุกอย่างที่ไม่ได้รับใช้สองเรื่องนี้ถูกตัดออก เพื่อให้หน้าจอเหลือเฉพาะสิ่งที่ต้องใช้จริง
 */
export default function App() {
  const { t } = useTranslation()
  const [started, setStarted] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [visible, setVisible] = useState(() => !document.hidden)
  const [follow, setFollow] = useState(true)

  const settings = useSettings()
  const geo = useGeolocation()
  const { speak, unlock } = useSpeech()
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
    geo.position.accuracy <= NAVIGATION_ACCURACY_M &&
    now - geo.position.timestamp <= POSITION_STALE_MS
  const usable = gpsUsable && visible

  const nav = useNavigation(geo.position, usable)
  const active = nav.status !== 'idle' && nav.status !== 'arrived'
  const where = useWhereAmI(geo.position)

  /**
   * การค้นหารอบตัวรับตำแหน่งที่หยาบกว่าการนำทางได้
   * เพราะคลาดเคลื่อน 50 เมตรไม่เปลี่ยนคำตอบว่า "รอบตัวมีร้านสะดวกซื้อไหม"
   * ถ้าใช้เกณฑ์เดียวกับการนำทาง ผู้ใช้ในอาคารจะกดค้นหาไม่ได้เลยทั้งที่ควรได้
   */
  const nearby = useNearbyPlaces(geo.position)
  const obstacleScan = useObstacleScan(nav.route, started)

  const wasPaused = useRef(false)
  useEffect(() => {
    const paused = active && !usable
    if (paused !== wasPaused.current) {
      if (paused) speechService.cancel()
      speak(t(paused ? 'nav.paused' : 'nav.resumed'), { priority: 'critical' })
    }
    wasPaused.current = paused
  }, [active, usable, speak, t])

  useGpsAnnouncer(geo, started && !active)
  useNavigationAnnouncer(nav, started)
  useHazardAlerts(nav, { enabled: started })
  useObstacleAlerts(nav, obstacleScan.report.obstacles, nav.route, {
    enabled: started && usable,
  })

  // สั่นเตือนก่อนถึงจุดเลี้ยว ล็อกไว้หนึ่งครั้งต่อจุด ไม่งั้นจะสั่นทุกครั้งที่ GPS อัปเดต
  const vibrated = useRef('')
  useEffect(() => {
    const progress = nav.progress
    if (
      nav.status !== 'navigating' ||
      !usable ||
      !progress ||
      progress.distanceToNextManeuver > MANEUVER_VIBRATION_DISTANCE_M
    )
      return
    const key = `${nav.route?.id}:${progress.currentStepIndex}`
    if (key === vibrated.current) return
    vibrated.current = key
    vibrate('maneuver')
  }, [nav.status, nav.progress, nav.route?.id, usable])

  const chooseDestination = useCallback(
    (place: Place) => {
      speechService.cancel()
      nearby.clear()
      nav.start(place)
      requestAnimationFrame(() => document.getElementById('navigation-panel')?.focus())
    },
    [nav, nearby],
  )

  /** พูดคำแนะนำปัจจุบันซ้ำ สำหรับตอนที่ฟังไม่ทันหรือมีเสียงรบกวน */
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
        { priority: 'critical' },
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
      return
    }
    speak(t(active ? 'nav.calculatingSpoken' : 'gps.acquiringSpoken'), { priority: 'critical' })
  }, [active, usable, nav, speak, t])

  /**
   * ปุ่มเดียวตอบคำถามที่ผู้ใช้ถามจริงว่า "ตอนนี้ฉันอยู่ไหน"
   * บอกทั้งที่อยู่และความแม่นยำ เพราะที่อยู่จะเชื่อได้แค่ไหนขึ้นกับความแม่นยำในขณะนั้น
   */
  const announceLocation = useCallback(() => {
    speechService.cancel()
    if (!geo.position) {
      speak(t('whereAmI.noPositionSpoken'), { priority: 'critical' })
      return
    }
    speak(t('actions.statusSpoken', { meters: Math.round(geo.position.accuracy) }), {
      priority: 'critical',
    })
    void where.announce()
  }, [geo.position, speak, t, where])

  const stopNavigation = useCallback(() => {
    nav.stop()
    speak(t('nav.stoppedSpoken'), { priority: 'critical' })
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
    )
  }, [nav, speak, t])

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
        <h1>{t('app.title')}</h1>
        <LanguageToggle />
      </header>

      <Announcer />
      <UpdatePrompt busy={active} />
      {!online && <OfflineBanner />}

      <main id="main-controls" tabIndex={-1}>
        {!started ? (
          <PermissionGate
            onStart={() => {
              // ต้องปลดล็อกเสียงจากใน handler ของปุ่มจริง ไม่ใช่จาก effect
              // ไม่งั้น iOS จะไม่ยอมให้แอปออกเสียงตลอดทั้ง session
              unlock()
              speak(t('gps.acquiringSpoken'))
              setStarted(true)
              geo.start()
            }}
          />
        ) : (
          <>
            {/* กำลังนำทาง = แสดงแค่สิ่งที่ต้องใช้ระหว่างเดิน ไม่มีอย่างอื่นมาแย่งความสนใจ */}
            {nav.status === 'idle' ? (
              <>
                <SearchPanel
                  position={geo.position}
                  onSelect={chooseDestination}
                  isOnline={online}
                />
                <NearbyPlaces
                  nearby={nearby}
                  position={geo.position}
                  onSelect={chooseDestination}
                  isOnline={online}
                />
              </>
            ) : (
              <>
                <NavigationPanel nav={{ ...nav, stop: stopNavigation }} onRepeat={repeat} />
                {nav.route && (
                  <ObstacleReport
                    report={obstacleScan.report}
                    isScanning={obstacleScan.isScanning}
                    announce={started}
                  />
                )}
              </>
            )}

            <BigButton variant="secondary" onClick={announceLocation} disabled={where.isLoading}>
              {t('whereAmI.button')}
            </BigButton>
            {where.address && <p className="where-address">{where.address}</p>}

            <GpsStatusPanel geo={geo} />

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

        {/*
          อยู่นอกเงื่อนไข started เพราะผู้ที่สายตาเลือนรางอาจต้องขยายตัวอักษร
          หรือเปลี่ยนธีมก่อน ถึงจะอ่านหน้าขออนุญาตใช้ตำแหน่งออก
        */}
        <details className="settings-section">
          <summary>{t('settings.openSettings')}</summary>
          <AppearancePanel settings={settings} />
        </details>

        <p className="safety-note">{t('nav.safetyNote')}</p>
        <footer>
          <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
          <p>Routing: FOSSGIS / OSRM</p>
        </footer>
      </main>
    </div>
  )
}
