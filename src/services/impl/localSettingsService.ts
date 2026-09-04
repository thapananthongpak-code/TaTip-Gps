import type { SettingsService } from '@/services/interfaces'
import { DEFAULT_SETTINGS } from '@/types'
import type { AppSettings, EmergencyContact, FontScale, ThemePreference } from '@/types'

const STORAGE_KEY = 'taathip.settings'

const FONT_SCALES: FontScale[] = ['normal', 'large', 'x-large']
const THEMES: ThemePreference[] = ['system', 'light', 'dark']

/** รับค่าเฉพาะที่อยู่ในชุดที่รู้จัก ค่าอื่นถือว่าข้อมูลเสียแล้วใช้ค่าเริ่มต้นแทน */
function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value)
    ? (value as T)
    : fallback
}

/** ตรวจรูปร่างข้อมูลที่อ่านมาจาก localStorage ก่อนใช้ กันข้อมูลเก่า/เสียหายทำแอปพัง */
function parseContacts(value: unknown): EmergencyContact[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): EmergencyContact[] => {
    if (typeof item !== 'object' || item === null) return []
    const { id, name, phone } = item as Record<string, unknown>
    if (typeof id !== 'string' || typeof name !== 'string' || typeof phone !== 'string') return []
    return [{ id, name, phone }]
  })
}

/**
 * เก็บค่าตั้งค่าใน localStorage ของเครื่องผู้ใช้
 *
 * ข้อมูลทั้งหมดในนี้ รวมถึงเบอร์ผู้ติดต่อฉุกเฉิน อยู่บนเครื่องผู้ใช้เท่านั้น
 * ไม่มีโค้ดส่วนใดของแอปส่งข้อมูลนี้ออกไปยังเซิร์ฟเวอร์ใดๆ (ดูหัวข้อความเป็นส่วนตัวใน README)
 */
export const localSettingsService: SettingsService = {
  load(): AppSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DEFAULT_SETTINGS

      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS
      const data = parsed as Record<string, unknown>

      return {
        fontScale: oneOf(data.fontScale, FONT_SCALES, DEFAULT_SETTINGS.fontScale),
        theme: oneOf(data.theme, THEMES, DEFAULT_SETTINGS.theme),
        vibrationEnabled:
          typeof data.vibrationEnabled === 'boolean'
            ? data.vibrationEnabled
            : DEFAULT_SETTINGS.vibrationEnabled,
        hazardAlertsEnabled:
          typeof data.hazardAlertsEnabled === 'boolean'
            ? data.hazardAlertsEnabled
            : DEFAULT_SETTINGS.hazardAlertsEnabled,
        emergencyContacts: parseContacts(data.emergencyContacts),
      }
    } catch {
      // localStorage ถูกปิด (โหมดส่วนตัวบางเบราว์เซอร์) หรือข้อมูลเสีย — ใช้ค่าเริ่มต้นแทน
      return DEFAULT_SETTINGS
    }
  },

  save(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // เขียนไม่ได้ก็ไม่ควรทำให้แอปล่มกลางทาง ค่าที่ตั้งไว้จะอยู่จนกว่าจะปิดแอป
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ไม่มีอะไรให้ทำต่อ
    }
  },
}
