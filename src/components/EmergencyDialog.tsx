import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EmergencyContact, GeoPosition } from '@/types'
import { shareService } from '@/services'
import { useSpeech } from '@/hooks/useSpeech'
import { BigButton } from './BigButton'

export function EmergencyDialog({
  contacts,
  position: incomingPosition,
  onClose,
}: {
  contacts: EmergencyContact[]
  position: GeoPosition | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const dialog = useRef<HTMLDialogElement>(null)
  const [result, setResult] = useState('')
  // Keep the reviewed message stable while the native share/SMS sheet is open.
  const [position] = useState(incomingPosition)
  const mapUrl = position ? shareService.buildMapUrl(position.lat, position.lng) : ''
  const message = position
    ? t('sos.messageTemplate', {
        latitude: position.lat.toFixed(6),
        longitude: position.lng.toFixed(6),
        accuracy: Math.round(position.accuracy),
        time: new Date(position.timestamp).toLocaleString(),
        url: mapUrl,
      })
    : t('sos.withoutLocation')
  const [openedAt] = useState(Date.now)
  const stale = position && openedAt - position.timestamp > 15000
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => {
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="emergency-title"
      className="emergency-dialog"
    >
      <h2 id="emergency-title" className="text-2xl font-bold">
        {t('sos.shareTitle')}
      </h2>
      <p>{t('sos.confirmHint')}</p>
      {stale && <p className="failure-notice">{t('sos.stale')}</p>}
      <textarea aria-label={t('sos.preview')} readOnly value={message} rows={5} />
      {contacts.map((contact) => (
        <BigButton
          key={contact.id}
          variant="danger"
          onClick={() => {
            shareService.openSms(contact.phone, message)
            setResult(t('sos.sendingSpoken'))
            speak(t('sos.sendingSpoken'))
          }}
        >
          {t('settings.sendToContact', { name: contact.name })}
        </BigButton>
      ))}
      <BigButton
        variant="secondary"
        onClick={async () => {
          const outcome = await shareService.share({
            title: t('sos.shareTitle'),
            text: message,
            url: mapUrl,
          })
          const text = t(
            outcome === 'copied'
              ? 'sos.copiedSpoken'
              : outcome === 'shared'
                ? 'sos.handedOff'
                : 'share.notSent',
          )
          setResult(text)
          speak(text)
        }}
      >
        {t('sos.shareAction')}
      </BigButton>
      <p aria-live="polite" aria-atomic="true">
        {result}
      </p>
      <BigButton variant="secondary" onClick={onClose}>
        {t('sos.close')}
      </BigButton>
    </dialog>
  )
}
