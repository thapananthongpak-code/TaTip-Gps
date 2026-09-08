import { useTranslation } from 'react-i18next'
import { BigButton } from './BigButton'

interface Props {
  onStart: () => void
  speechSupported: boolean
}

/**
 * หน้าจอแรกก่อนขอสิทธิ์ตำแหน่ง
 *
 * ตั้งใจให้ต้องแตะปุ่มก่อนหนึ่งครั้ง ไม่ขอสิทธิ์อัตโนมัติ เพราะ:
 * 1) ผู้ใช้ควรรู้ก่อนว่าทำไมแอปต้องใช้ตำแหน่ง (ความโปร่งใส/PDPA)
 * 2) iOS ต้องมี user gesture ก่อนถึงจะยอมให้เล่นเสียงพูดได้
 */
export function PermissionGate({ onStart, speechSupported }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h2 className="text-2xl font-bold">{t('permission.title')}</h2>
      <p className="max-w-md text-lg leading-relaxed text-slate-700 dark:text-slate-200">
        {t('permission.body')}
      </p>

      <BigButton onClick={onStart} aria-describedby="start-hint" className="w-full max-w-md">
        {t('permission.startButton')}
      </BigButton>
      <p id="start-hint" className="text-base text-slate-600 dark:text-slate-300">
        {t('permission.startButtonHint')}
      </p>

      {!speechSupported && (
        <p className="max-w-md rounded-xl bg-amber-100 p-4 text-base text-amber-950">
          {t('errors.speechUnsupported')}
        </p>
      )}
    </div>
  )
}
