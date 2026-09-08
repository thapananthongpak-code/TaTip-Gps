import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { speechService } from '@/services'
import { useSpeech } from '@/hooks/useSpeech'
import { BigButton } from './BigButton'

/** Keep the region mounted. All automatic announcements have exactly one owner. */
export function VoiceControls() {
  const { t } = useTranslation()
  const { speak, unlock } = useSpeech()
  const state = useSyncExternalStore(speechService.subscribe, speechService.getSnapshot)
  return (
    <section className="voice-controls" aria-label={t('voice.title')}>
      <label htmlFor="voice-mode">{t('voice.title')}</label>
      <select
        id="voice-mode"
        value={state.mode}
        onChange={(event) => {
          const mode = event.target.value === 'app' ? 'app' : 'reader'
          speechService.setMode(mode)
          try {
            localStorage.setItem('taathip.voice', mode)
          } catch {
            /* Session still works. */
          }
        }}
      >
        <option value="reader">{t('voice.reader')}</option>
        <option value="app">{t('voice.app')}</option>
      </select>
      <p className="text-base">
        {t(state.mode === 'reader' ? 'voice.readerHint' : 'voice.appHint')}
      </p>
      <div className="action-row">
        <BigButton
          variant="secondary"
          onClick={() => {
            speechService.cancel()
            unlock()
            speak(t('voice.testMessage'), { priority: 'critical' })
          }}
        >
          {t('voice.test')}
        </BigButton>
        <BigButton variant="secondary" onClick={() => speechService.cancel()}>
          {t('voice.stop')}
        </BigButton>
      </div>
      {state.failed && <p className="failure-notice">{t('voice.failed')}</p>}
      <p className="last-announcement">
        <span className="font-bold">{t('voice.last')}: </span>
        {state.text || t('voice.ready')}
      </p>
      <div
        className="sr-only"
        aria-live={state.mode === 'reader' || state.failed ? 'polite' : 'off'}
        aria-atomic="true"
        data-testid="announcer"
      >
        <span key={state.sequence}>
          {state.failed ? t('voice.failed') + ' ' : ''}
          {state.text}
        </span>
      </div>
    </section>
  )
}
