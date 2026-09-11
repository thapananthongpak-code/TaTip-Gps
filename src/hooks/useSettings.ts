import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSpeech } from './useSpeech'
import { settingsService } from '@/services'
import type { AppSettings, EmergencyContact, FontScale, ThemePreference } from '@/types'

export interface UseSettingsResult {
  settings: AppSettings
  storageFailed: boolean
  setFontScale: (scale: FontScale) => void
  setTheme: (theme: ThemePreference) => void
  addContact: (name: string, phone: string) => void
  removeContact: (id: string) => void
  /** ลบข้อมูลทั้งหมดที่แอปเก็บไว้บนเครื่อง */
  clearAll: () => boolean
}

/**
 * ค่าตั้งค่าของผู้ใช้ ซิงก์กับ localStorage ทุกครั้งที่เปลี่ยน
 * อ่านค่าเริ่มต้นแบบ lazy เพื่อไม่ให้แตะ localStorage ทุกครั้งที่ re-render
 */
export function useSettings(): UseSettingsResult {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.load())
  const [storageFailed, setStorageFailed] = useState(false)

  const update = useCallback(
    (next: AppSettings) => {
      setSettings(next)
      const saved = settingsService.save(next)
      setStorageFailed(!saved)
      if (!saved) speak(t('settings.storageFailed'), { priority: 'critical' })
    },
    [speak, t],
  )

  const setFontScale = useCallback(
    (fontScale: FontScale) => update({ ...settings, fontScale }),
    [settings, update],
  )

  const setTheme = useCallback(
    (theme: ThemePreference) => update({ ...settings, theme }),
    [settings, update],
  )

  const addContact = useCallback(
    (name: string, phone: string) => {
      if (
        !name.trim() ||
        name.length > 80 ||
        !/^[+]?[0-9]{6,15}$/.test(phone.replace(/[ ()-]/g, ''))
      )
        return
      const contact: EmergencyContact = {
        id: crypto.randomUUID(),
        name: name.trim(),
        phone: phone.trim(),
      }
      update({ ...settings, emergencyContacts: [...settings.emergencyContacts, contact] })
    },
    [settings, update],
  )

  const removeContact = useCallback(
    (id: string) =>
      update({
        ...settings,
        emergencyContacts: settings.emergencyContacts.filter((c) => c.id !== id),
      }),
    [settings, update],
  )

  const clearAll = useCallback(() => {
    const cleared = settingsService.clear()
    setStorageFailed(!cleared)
    if (!cleared) {
      speak(t('settings.storageFailed'), { priority: 'critical' })
      return false
    }
    setSettings(settingsService.load())
    return true
  }, [speak, t])

  return {
    settings,
    storageFailed,
    setFontScale,
    setTheme,
    addContact,
    removeContact,
    clearAll,
  }
}
