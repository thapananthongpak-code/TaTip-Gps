import type { SettingsService } from '@/services/interfaces'
import { DEFAULT_SETTINGS } from '@/types'
import type { AppSettings, FontScale, ThemePreference } from '@/types'

const STORAGE_KEY = 'taathip.settings'

const FONT_SCALES: FontScale[] = ['normal', 'large', 'x-large']
const THEMES: ThemePreference[] = ['system', 'light', 'dark']

/** รับค่าเฉพาะที่อยู่ในชุดที่รู้จัก ค่าอื่นถือว่าข้อมูลเสียแล้วใช้ค่าเริ่มต้นแทน */
function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value)
    ? (value as T)
    : fallback
}

/**
 * เก็บค่าตั้งค่าใน localStorage ของเครื่องผู้ใช้
 *
 * ข้อมูลทั้งหมดในนี้อยู่บนเครื่องผู้ใช้เท่านั้น
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
      }
    } catch {
      // localStorage ถูกปิด (โหมดส่วนตัวบางเบราว์เซอร์) หรือข้อมูลเสีย — ใช้ค่าเริ่มต้นแทน
      return DEFAULT_SETTINGS
    }
  },

  save(settings: AppSettings): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      return true
    } catch {
      return false
    }
  },

  clear(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEY)
      return true
    } catch {
      return false
    }
  },
}
