import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import type { ServiceLanguage } from '@/types'
import en from './locales/en.json'
import th from './locales/th.json'

export const SUPPORTED_LANGUAGES = ['th', 'en'] as const

/** คีย์ที่ใช้จำภาษาที่ผู้ใช้เลือกไว้ใน localStorage */
export const LANGUAGE_STORAGE_KEY = 'taathip.language'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      th: { translation: th },
      en: { translation: en },
    },
    fallbackLng: 'th',
    supportedLngs: SUPPORTED_LANGUAGES,
    // ให้ th-TH หรือ en-GB ที่เบราว์เซอร์ส่งมา ตกลงมาเป็น th / en ได้เอง
    nonExplicitSupportedLngs: true,
    interpolation: {
      // React หนีอักขระพิเศษให้อยู่แล้ว
      escapeValue: false,
    },
    detection: {
      // ภาษาที่ผู้ใช้เลือกไว้มาก่อนภาษาของเบราว์เซอร์เสมอ
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
  })

/** ภาษาปัจจุบันในรูปแบบที่ service ใช้ ('th' | 'en') */
export function currentLanguage(): ServiceLanguage {
  const base = i18n.resolvedLanguage ?? i18n.language ?? 'th'
  return base.startsWith('en') ? 'en' : 'th'
}

/**
 * บอกภาษาของเอกสารให้โปรแกรมอ่านหน้าจอรู้
 * สำคัญมากเพราะ VoiceOver เลือกเสียงอ่านจาก lang ของเนื้อหา
 * ถ้าไม่ตั้ง ข้อความไทยจะถูกอ่านด้วยเสียงอังกฤษจนฟังไม่รู้เรื่อง
 */
function syncLanguage() {
  document.documentElement.lang = currentLanguage()
  document.title = i18n.t('app.title')
}
syncLanguage()
i18n.on('languageChanged', syncLanguage)

export default i18n
