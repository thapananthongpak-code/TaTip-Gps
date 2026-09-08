import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { AppearancePanel } from '@/components/AppearancePanel'
import { BigButton } from '@/components/BigButton'
import { EmergencyDialog } from '@/components/EmergencyDialog'
import { GpsStatusPanel } from '@/components/GpsStatusPanel'
import { LanguageToggle } from '@/components/LanguageToggle'
import { MapView } from '@/components/MapView'
import { NavigationPanel } from '@/components/NavigationPanel'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PermissionGate } from '@/components/PermissionGate'
import { SafetyPanel } from '@/components/SafetyPanel'
import { SearchPanel } from '@/components/SearchPanel'
import { SharedLocationView } from '@/components/SharedLocationView'
import { SosButton } from '@/components/SosButton'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { VoiceControls } from '@/components/VoiceControls'
import { useAppearance } from '@/hooks/useAppearance'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useGpsAnnouncer } from '@/hooks/useGpsAnnouncer'
import { useHazardAlerts } from '@/hooks/useHazardAlerts'
import { useLiveShare } from '@/hooks/useLiveShare'
import { useNavigation } from '@/hooks/useNavigation'
import { useNavigationAnnouncer } from '@/hooks/useNavigationAnnouncer'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSettings } from '@/hooks/useSettings'
import { useShareRoute } from '@/hooks/useShareRoute'
import { useSpeech } from '@/hooks/useSpeech'
import { useWhereAmI } from '@/hooks/useWhereAmI'
import { speechService } from '@/services'
import { speakDistance } from '@/utils/format'
import { vibrate } from '@/utils/vibration'

export default function App() {
  const { t } = useTranslation()
  const [started, setStarted] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [visible, setVisible] = useState(() => !document.hidden)
  const [follow, setFollow] = useState(true)
  const settings = useSettings()
  const shareRoute = useShareRoute()
  const geo = useGeolocation()
  const audio = useSyncExternalStore(speechService.subscribe, speechService.getSnapshot)
  const { speak, unlock, supported } = useSpeech()
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
  const usable = gpsUsable && visible && !audio.failed && !emergencyOpen
  const nav = useNavigation(geo.position, usable)
  const active = nav.status !== 'idle' && nav.status !== 'arrived'
  const where = useWhereAmI(gpsUsable ? geo.position : null)
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
  useNavigationAnnouncer(nav, started, audio.mode)
  useHazardAlerts(nav, {
    enabled: started && settings.settings.hazardAlertsEnabled,
    vibrationEnabled: settings.settings.vibrationEnabled,
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
    vibrate('maneuver', settings.settings.vibrationEnabled)
  }, [nav.status, nav.progress, nav.route?.id, usable, settings.settings.vibrationEnabled])

  const repeat = useCallback(() => {
    speechService.cancel()
    unlock()
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
    unlock,
  ])

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
      <main id="main-controls" tabIndex={-1}>
        <div className="emergency-access">
          <SosButton
            onTrigger={openEmergency}
            vibrationEnabled={settings.settings.vibrationEnabled}
          />
        </div>
        {started && (
          <section className="primary-controls" aria-label={t('a11y.mainLabel')}>
            {nav.status === 'idle' ? (
              <SearchPanel
                position={geo.position}
                onSelect={(place) => {
                  speechService.cancel()
                  nav.start(place)
                  requestAnimationFrame(() => document.getElementById('navigation-panel')?.focus())
                }}
                isOnline={online}
              />
            ) : (
              <NavigationPanel nav={{ ...nav, stop: stopNavigation }} onRepeat={repeat} />
            )}
            <BigButton variant="secondary" onClick={where.announce} disabled={where.isLoading}>
              {t('whereAmI.button')}
            </BigButton>
            {where.address && <p>{where.address}</p>}
            <GpsStatusPanel
              geo={geo}
              onRepeatStatus={() => {
                unlock()
                speak(
                  !gpsUsable
                    ? t('nav.paused')
                    : t('actions.statusSpoken', { meters: Math.round(geo.position!.accuracy) }),
                )
              }}
            />
          </section>
        )}
        <VoiceControls />
        {!started && (
          <PermissionGate
            speechSupported={supported}
            onStart={() => {
              unlock()
              speak(t('gps.acquiringSpoken'))
              setStarted(true)
              geo.start()
            }}
          />
        )}
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
        </details>
        <details className="settings-section">
          <summary>{t('appearance.openPanel')}</summary>
          <AppearancePanel settings={settings} />
        </details>
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
