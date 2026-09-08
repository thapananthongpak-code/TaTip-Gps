import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseSettingsResult } from '@/hooks/useSettings'
import type { FontScale, ThemePreference } from '@/types'

const FONT_SCALES: FontScale[] = ['normal', 'large', 'x-large']
const THEMES: ThemePreference[] = ['system', 'light', 'dark']

/**
 * ตัวเลือกกลุ่มหนึ่ง ใช้ radiogroup แทน select
 *
 * เพราะปุ่มที่เห็นทุกตัวพร้อมกันแตะง่ายกว่า และ screen reader อ่านได้ครบว่ามีตัวเลือกอะไรบ้าง
 * ต่างจาก select ที่ต้องเปิดเมนูก่อนถึงจะรู้ว่ามีอะไร
 */
function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  labelFor,
}: {
  label: string
  value: T
  options: T[]
  onChange: (value: T) => void
  labelFor: (option: T) => string
}) {
  const name = useId()
  return (
    <fieldset>
      <legend className="text-base font-bold">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option === value
          return (
            <label
              key={option}
              className={`min-h-touch cursor-pointer rounded-xl border-2 px-4 py-2 text-lg font-bold ${
                selected
                  ? 'border-brand-700 bg-brand-600 text-white'
                  : 'border-slate-500 dark:border-slate-400'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="mr-2"
              />
              {labelFor(option)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** ตั้งค่าการแสดงผล: ขนาดตัวอักษรและธีมสี */
export function AppearancePanel({ settings }: { settings: UseSettingsResult }) {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t('appearance.title')}
      className="flex flex-col gap-4 border-t-2 border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <h2 className="text-lg font-bold">{t('appearance.title')}</h2>

      <OptionGroup
        label={t('appearance.fontSize')}
        value={settings.settings.fontScale}
        options={FONT_SCALES}
        onChange={settings.setFontScale}
        labelFor={(option) => t(`appearance.fontScale.${option}`)}
      />

      <OptionGroup
        label={t('appearance.theme')}
        value={settings.settings.theme}
        options={THEMES}
        onChange={settings.setTheme}
        labelFor={(option) => t(`appearance.themeOption.${option}`)}
      />
    </section>
  )
}
