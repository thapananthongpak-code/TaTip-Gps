import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseSettingsResult } from '@/hooks/useSettings'
import type { EmergencyContact } from '@/types'
import { isVibrationSupported } from '@/utils/vibration'
import { useSpeech } from '@/hooks/useSpeech'
import { BigButton } from './BigButton'

/**
 * ปุ่มลบข้อมูลแบบต้องแตะสองครั้ง
 *
 * เหตุผลเดียวกับปุ่ม SOS ที่ต้องกดค้าง: ผู้ใช้ที่มองไม่เห็นสำรวจหน้าจอด้วยการแตะ
 * ปุ่มที่ลบทันทีอาจทำให้เบอร์ผู้ติดต่อฉุกเฉินหายไปโดยไม่รู้ตัว
 * และจะรู้อีกทีตอนที่ต้องใช้จริง
 */
function ClearDataButton({ onConfirm }: { onConfirm: () => boolean }) {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  const handleClick = useCallback(() => {
    if (awaitingConfirm) {
      setAwaitingConfirm(false)
      if (onConfirm()) speak(t('settings.clearDataDoneSpoken'), { priority: 'critical' })
      return
    }
    setAwaitingConfirm(true)
    speak(t('settings.clearDataConfirmSpoken'), { priority: 'critical' })
  }, [awaitingConfirm, onConfirm, speak, t])

  return (
    <>
      <BigButton variant={awaitingConfirm ? 'danger' : 'secondary'} onClick={handleClick}>
        {awaitingConfirm ? t('settings.clearDataConfirm') : t('settings.clearData')}
      </BigButton>
      {awaitingConfirm && (
        <BigButton variant="secondary" onClick={() => setAwaitingConfirm(false)}>
          {t('settings.cancelClear')}
        </BigButton>
      )}
      <p className="-mt-1 text-sm text-slate-600 dark:text-slate-300">
        {t('settings.clearDataNote')}
      </p>
    </>
  )
}

interface Props {
  settings: UseSettingsResult
  onSos: (contactPhone?: string) => void
  hasPosition: boolean
  share: {
    isSharing: boolean
    expiresAt: number | null
    onStart: () => void
    onSendUpdate: () => void
    onStop: () => void
  }
}

/** ฟอร์มเพิ่มผู้ติดต่อฉุกเฉิน */
function ContactForm({ onAdd }: { onAdd: (name: string, phone: string) => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const canSubmit = name.trim().length > 0 && /^[+]?[0-9]{6,15}$/.test(phone.replace(/[ ()-]/g, ''))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        onAdd(name, phone)
        setName('')
        setPhone('')
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <label className="text-base font-bold" htmlFor="contact-name">
        {t('settings.contactName')}
      </label>
      <input
        id="contact-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        maxLength={80}
        className="min-h-touch rounded-xl border-2 border-slate-500 px-4 py-2 text-lg dark:border-slate-400 dark:bg-slate-800"
      />

      <label className="text-base font-bold" htmlFor="contact-phone">
        {t('settings.contactPhone')}
      </label>
      <input
        id="contact-phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        maxLength={24}
        className="min-h-touch rounded-xl border-2 border-slate-500 px-4 py-2 text-lg dark:border-slate-400 dark:bg-slate-800"
      />

      <BigButton type="submit" disabled={!canSubmit}>
        {t('settings.addContact')}
      </BigButton>
    </form>
  )
}

function ContactRow({
  contact,
  onSos,
  onRemove,
}: {
  contact: EmergencyContact
  onSos: (phone: string) => void
  onRemove: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <li className="flex items-center gap-2 rounded-xl border-2 border-slate-500 p-2 dark:border-slate-400">
      <span className="flex-1">
        <span className="block text-lg font-bold">{contact.name}</span>
        <span className="block text-sm text-slate-600 dark:text-slate-300">{contact.phone}</span>
      </span>
      <BigButton
        variant="secondary"
        onClick={() => onSos(contact.phone)}
        aria-label={t('settings.sendToContact', { name: contact.name })}
      >
        {t('settings.send')}
      </BigButton>
      <BigButton
        variant="secondary"
        onClick={() => onRemove(contact.id)}
        aria-label={t('settings.removeContact', { name: contact.name })}
      >
        ✕
      </BigButton>
    </li>
  )
}

/** แผงความปลอดภัย: ปุ่ม SOS, ผู้ติดต่อฉุกเฉิน, แชร์ตำแหน่ง และตัวเลือกการเตือน */
export function SafetyPanel({ settings, onSos, hasPosition, share }: Props) {
  const { t } = useTranslation()
  const { settings: values, addContact, removeContact } = settings
  const contacts = values.emergencyContacts

  return (
    <section
      aria-label={t('settings.safetyTitle')}
      className="border-t-2 border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <h2 className="text-lg font-bold">{t('settings.safetyTitle')}</h2>
      {settings.storageFailed && <p className="failure-notice">{t('settings.storageFailed')}</p>}

      <p className="mt-3">{t('sos.confirmHint')}</p>

      {/* แชร์ตำแหน่ง */}
      <div className="mt-4">
        <h3 className="text-base font-bold">{t('share.title')}</h3>
        {share.isSharing ? (
          <>
            <p className="mt-1 text-base">
              {t('share.activeUntil', {
                time: share.expiresAt ? new Date(share.expiresAt).toLocaleTimeString() : '',
              })}
            </p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              {t('share.snapshotNotice')}
            </p>
            <div className="mt-2 flex gap-2">
              <BigButton onClick={share.onSendUpdate} className="flex-1">
                {t('share.sendUpdate')}
              </BigButton>
              <BigButton variant="secondary" onClick={share.onStop} className="flex-1">
                {t('share.stop')}
              </BigButton>
            </div>
          </>
        ) : (
          <BigButton
            variant="secondary"
            onClick={share.onStart}
            disabled={!hasPosition}
            className="mt-2 w-full"
          >
            {t('share.start')}
          </BigButton>
        )}
      </div>

      {/* ผู้ติดต่อฉุกเฉิน */}
      <div className="mt-4">
        <h3 className="text-base font-bold">{t('settings.contactsTitle')}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('settings.contactsPrivacy')}
        </p>
        {contacts.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {contacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onSos={onSos}
                onRemove={removeContact}
              />
            ))}
          </ul>
        )}
        <ContactForm onAdd={addContact} />
      </div>

      {/* ตัวเลือกการเตือน */}
      <div className="mt-4 flex flex-col gap-3">
        <h3 className="text-base font-bold">{t('settings.alertsTitle')}</h3>

        <label className="flex min-h-touch items-center gap-3 text-lg">
          <input
            type="checkbox"
            checked={values.hazardAlertsEnabled}
            onChange={(e) => settings.setHazardAlertsEnabled(e.target.checked)}
            className="size-6"
          />
          {t('settings.hazardAlerts')}
        </label>
        {/* บอกข้อจำกัดตรงๆ ผู้ใช้ต้องไม่เข้าใจว่าคำเตือนนี้ยืนยันว่ามีทางข้ามจริง */}
        <p className="-mt-1 text-sm text-slate-600 dark:text-slate-300">{t('hazard.disclaimer')}</p>

        <label className="flex min-h-touch items-center gap-3 text-lg">
          <input
            type="checkbox"
            checked={values.vibrationEnabled}
            onChange={(e) => settings.setVibrationEnabled(e.target.checked)}
            disabled={!isVibrationSupported()}
            className="size-6"
          />
          {t('settings.vibration')}
        </label>
        {!isVibrationSupported() && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('settings.vibrationUnsupported')}
          </p>
        )}

        <ClearDataButton onConfirm={settings.clearAll} />
      </div>
    </section>
  )
}
