import { useTranslation } from 'react-i18next'

interface Props {
  follow: boolean
  onRecenter: () => void
  disabled: boolean
}

/**
 * ปุ่มลอยบนแผนที่
 * ไม่ใช้ zoom control ของ Leaflet เพราะปุ่มเล็กเกินเกณฑ์ touch target 48px
 */
export function MapControls({ follow, onRecenter, disabled }: Props) {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[1000] flex justify-end px-4">
      <button
        type="button"
        onClick={onRecenter}
        disabled={disabled}
        aria-pressed={follow}
        aria-label={t('map.recenter')}
        className="pointer-events-auto flex min-h-touch min-w-touch cursor-pointer items-center gap-2 rounded-2xl bg-white px-4 py-3 text-base font-bold text-slate-900 shadow-lg ring-2 ring-slate-400 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-50 dark:ring-slate-500"
      >
        <span aria-hidden="true">◎</span>
        {t('map.recenter')}
      </button>
    </div>
  )
}
