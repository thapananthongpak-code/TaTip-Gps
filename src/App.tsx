import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Announcer } from '@/components/Announcer'
import { BigButton } from '@/components/BigButton'
import { GpsStatusPanel } from '@/components/GpsStatusPanel'
import { LanguageToggle } from '@/components/LanguageToggle'
import { MapView } from '@/components/MapView'
import { NavigationPanel } from '@/components/NavigationPanel'
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
import { useObstacleAlerts } from '@/hooks/useObstacleAlerts'
import { useObstacleScan } from '@/hooks/useObstacleScan'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSpeech } from '@/hooks/useSpeech'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useWhereAmI } from '@/hooks/useWhereAmI'
import { currentLanguage } from '@/i18n'
import { speechService } from '@/services'
import type { Place } from '@/types'
import { speakDistance } from '@/utils/format'
import { movementFrom } from '@/utils/movement'
import { speakableStreet } from '@/utils/script'
import { vibrate } from '@/utils/vibration'

/** ระยะที่เริ่มสั่นเตือนก่อนถึงจุดเลี้ยว (เมตร) — ตรงกับจังหวะที่เสียงเตือนดัง */
const MANEUVER_VIBRATION_DISTANCE_M = 20

/** GPS ที่แม่นยำแย่กว่านี้ (เมตร) เชื่อถือไม่ได้พอจะใช้นำทาง */
const NAVIGATION_ACCURACY_M = 30

/** ตำแหน่งที่เก่ากว่านี้ (มิลลิวินาที) ถือว่าค้าง */
const POSITION_STALE_MS = 15_000

/**
 * หยุดนิ่งนานกว่านี้ระหว่างนำทาง ถึงจะถามว่ายังอยู่ไหม
 *
 * ตั้งไว้ยาวพอที่การรอข้ามถนน รอไฟเขียว หรือหยุดคุยกับใครสักคน
 * จะไม่ทำให้แอปพูดขึ้นมาแทรกโดยไม่จำเป็น
 */
const STATIONARY_CHECK_MS = 180_000

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
  const [searchResults, setSearchResults] = useState<Place[]>([])

  const geo = useGeolocation()
  const { speak, unlock } = useSpeech()
  const online = useOnlineStatus(started)
  useAppearance()

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

  /*
   * ติดตามว่าผู้ใช้กำลังเดิน หยุด หรืออยู่บนยานพาหนะ
   * เริ่มเก็บตั้งแต่ได้ตำแหน่ง ไม่ต้องรอเริ่มนำทาง เพื่อให้มีข้อมูลพอตั้งแต่ก้าวแรก
   */
  const movement = useMemo(() => movementFrom(geo.history), [geo.history])
  const inVehicle = movement.mode === 'vehicle'

  const nav = useNavigation(geo.position, usable && !inVehicle, movement.paceMps)
  const active = nav.status !== 'idle' && nav.status !== 'arrived'
  /*
   * กันหน้าจอดับตลอดการเดินทาง
   *
   * ถ้าไม่กัน เครื่องจะล็อกเองภายในครึ่งนาที แล้ว visibilitychange จะพักการนำทาง
   * ผู้ใช้ที่มองไม่เห็นจะเดินต่อโดยไม่มีเสียงบอกทางอีกเลย โดยไม่รู้ว่าต้องปลุกจอเอง
   */
  useWakeLock(active)
  const where = useWhereAmI(geo.position)

  const obstacleScan = useObstacleScan(nav.route, started)

  const wasPaused = useRef(false)
  useEffect(() => {
    const paused = active && !usable
    if (paused === wasPaused.current) return
    wasPaused.current = paused
    /*
     * การเดินทางจบหรือถูกยกเลิกไปแล้ว ไม่ใช่การกลับมาพร้อมใช้งาน
     * ถ้าไม่ดักไว้ ผู้ใช้ที่กดหยุดตอนสัญญาณหายจะได้ยินว่า "พร้อมให้คำแนะนำอีกครั้ง"
     * ทั้งที่เพิ่งสั่งหยุดไปเอง ซึ่งชวนให้เข้าใจผิดว่าระบบยังนำทางอยู่
     */
    if (!paused && !active) return
    if (paused) speechService.cancel()
    /*
     * บอกเหตุผลที่พักให้ตรง ไม่งั้นคนที่อยู่บนรถจะได้ยินว่า "ตำแหน่งไม่แม่นพอ"
     * แล้วไปยืนรอสัญญาณกลางถนน ทั้งที่ปัญหาคือกำลังนั่งรถอยู่
     */
    const key = paused ? (inVehicle ? 'nav.vehicleSpeedSpoken' : 'nav.paused') : 'nav.resumed'
    speak(t(key), { priority: 'critical' })
  }, [active, usable, inVehicle, speak, t])

  /*
   * หยุดนิ่งนานผิดปกติระหว่างนำทาง มักแปลว่ามีบางอย่างไม่เป็นไปตามแผน
   * เช่น สับสนว่าอยู่ตรงไหน ทางตัน หรือรอคนช่วยอยู่
   * ถามครั้งเดียวต่อการหยุดหนึ่งครั้ง ไม่ถามซ้ำจนกลายเป็นเสียงรบกวน
   */
  const askedWhileStopped = useRef(false)
  useEffect(() => {
    if (!active || !usable || movement.mode !== 'stationary') {
      if (movement.mode !== 'stationary') askedWhileStopped.current = false
      return
    }
    if (movement.stationaryMs < STATIONARY_CHECK_MS || askedWhileStopped.current) return
    askedWhileStopped.current = true
    speak(t('nav.stillThereSpoken'), { priority: 'normal' })
  }, [active, usable, movement.mode, movement.stationaryMs, speak, t])

  useGpsAnnouncer(geo, started && !active)

  /*
   * บอกวิธีใช้หนึ่งครั้งหลังได้ตำแหน่งแล้ว
   *
   * จุดนี้เคยเงียบสนิท: ผู้ใช้กดอนุญาต ได้ยินว่าพบตำแหน่งแล้ว จากนั้นไม่มีอะไรอีกเลย
   * ทั้งที่ยังไม่รู้ว่าต้องทำอะไรต่อ เพราะมองไม่เห็นช่องค้นหาที่อยู่บนจอ
   */
  const welcomed = useRef(false)
  useEffect(() => {
    if (!started || welcomed.current || nav.status !== 'idle' || !geo.position) return
    welcomed.current = true
    speak(t('search.welcomeSpoken'))
  }, [started, nav.status, geo.position, speak, t])
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
      speak(t('search.selectedSpoken', { destination: place.name }), { priority: 'critical' })
      nav.start(place)
      requestAnimationFrame(() => document.getElementById('navigation-panel')?.focus())
    },
    [nav, speak, t],
  )

  /** พูดคำแนะนำปัจจุบันซ้ำ สำหรับตอนที่ฟังไม่ทันหรือมีเสียงรบกวน */
  const repeat = useCallback(() => {
    speechService.cancel()
    if (active && (!usable || inVehicle)) {
      speak(t(inVehicle ? 'nav.vehicleSpeedSpoken' : 'nav.paused'), { priority: 'critical' })
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
      const street = speakableStreet(step.streetName, currentLanguage())
      speak(
        t(street ? 'nav.stepInstructionWithStreet' : 'nav.stepInstruction', {
          distance: speakDistance(nav.progress.distanceToNextManeuver),
          maneuver: t('maneuver.' + step.maneuver),
          street,
        }),
        { group: 'navigation', priority: 'critical' },
      )
      return
    }
    speak(t(active ? 'nav.calculatingSpoken' : 'gps.acquiringSpoken'), { priority: 'critical' })
  }, [active, usable, inVehicle, nav, speak, t])

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

  /** จบการเดินทางหลังถึงจุดหมาย — ต่างจากการยกเลิกกลางทางทั้งข้อความและความรู้สึก */
  const finishTrip = useCallback(() => {
    nav.stop()
    speak(t('nav.finishedSpoken'), { priority: 'critical' })
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
    )
  }, [nav, speak, t])

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
              <section aria-label={t('search.label')} className="panel">
                <h2>{t('search.heading')}</h2>
                <SearchPanel
                  position={geo.position}
                  onSelect={chooseDestination}
                  isOnline={online}
                  onResults={setSearchResults}
                />
              </section>
            ) : (
              <>
                <NavigationPanel
                  nav={{ ...nav, stop: stopNavigation }}
                  onRepeat={repeat}
                  onFinish={finishTrip}
                  inVehicle={inVehicle}
                />
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
                results={nav.status === 'idle' ? searchResults : []}
                obstacles={obstacleScan.report.obstacles}
                onSelectResult={chooseDestination}
              />
            </div>
            <BigButton variant="secondary" onClick={() => setFollow(true)}>
              {t('map.recenter')}
            </BigButton>
          </>
        )}

        <p className="safety-note">{t('nav.safetyNote')}</p>
        <footer>
          <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
          <p>Routing: FOSSGIS / OSRM</p>
        </footer>
      </main>
    </div>
  )
}
