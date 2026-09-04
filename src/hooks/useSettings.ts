import { useCallback, useState } from 'react'
import { settingsService } from '@/services'
import type { AppSettings, EmergencyContact, FontScale, ThemePreference } from '@/types'

export interface UseSettingsResult {
  settings: AppSettings
  setFontScale: (scale: FontScale) => void
  setTheme: (theme: ThemePreference) => void
  setVibrationEnabled: (enabled: boolean) => void
  setHazardAlertsEnabled: (enabled: boolean) => void
  addContact: (name: string, phone: string) => void
  removeContact: (id: string) => void
  /** ลบข้อมูลทั้งหมดที่แอปเก็บไว้บนเครื่อง */
  clearAll: () => void
}

/**
 * ค่าตั้งค่าของผู้ใช้ ซิงก์กับ localStorage ทุกครั้งที่เปลี่ยน
 * อ่านค่าเริ่มต้นแบบ lazy เพื่อไม่ให้แตะ localStorage ทุกครั้งที่ re-render
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.load())

  const update = useCallback((next: AppSettings) => {
    setSettings(next)
    settingsService.save(next)
  }, [])

  const setFontScale = useCallback(
    (fontScale: FontScale) => update({ ...settings, fontScale }),
    [settings, update],
  )

  const setTheme = useCallback(
    (theme: ThemePreference) => update({ ...settings, theme }),
    [settings, update],
  )

  const setVibrationEnabled = useCallback(
    (vibrationEnabled: boolean) => update({ ...settings, vibrationEnabled }),
    [settings, update],
  )

  const setHazardAlertsEnabled = useCallback(
    (hazardAlertsEnabled: boolean) => update({ ...settings, hazardAlertsEnabled }),
    [settings, update],
  )

  const addContact = useCallback(
    (name: string, phone: string) => {
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
    settingsService.clear()
    setSettings(settingsService.load())
  }, [])

  return {
    settings,
    setFontScale,
    setTheme,
    setVibrationEnabled,
    setHazardAlertsEnabled,
    addContact,
    removeContact,
    clearAll,
  }
}
