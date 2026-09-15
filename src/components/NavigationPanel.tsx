import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { NAVIGATION_ACCURACY_M } from '@/services'
import type { UseNavigationResult } from '@/hooks/useNavigation'
import { formatDistance, speakDistance } from '@/utils/format'
import { ARRIVAL_RADIUS_M } from '@/utils/navigation'
import { speakableStreet } from '@/utils/script'
import { BigButton } from './BigButton'

/** ประโยคคำแนะนำที่แสดงบนจอ — โครงเดียวกับที่พูดออกเสียง เพื่อไม่ให้สองทางไม่ตรงกัน */
function instructionText(t: TFunction, progress: NonNullable<UseNavigationResult['progress']>) {
  const step = progress.nextStep
  if (!step) return ''
  const maneuver = t(`maneuver.${step.maneuver}`)
  const distance = speakDistance(progress.distanceToNextManeuver)
  // ต้องกรองชื่อถนนแบบเดียวกับที่เสียงพูด ไม่งั้นจอกับเสียงจะไม่ตรงกัน
  const street = speakableStreet(step.streetName, currentLanguage())
  return street
    ? t('nav.stepInstructionWithStreet', { distance, maneuver, street })
    : t('nav.stepInstruction', { distance, maneuver })
}

interface Props {
  nav: UseNavigationResult
  onRepeat: () => void
  /** จบการเดินทางเมื่อถึงจุดหมายแล้ว ต่างจากการยกเลิกกลางทาง */
  onFinish: () => void
  /** ลองคำนวณเส้นทางใหม่ — ต้องบอกผลด้วยเสียงทุกครั้งที่กด */
  onRetry: () => void
  /**
   * true = ที่พักคำแนะนำเพราะกำลังเคลื่อนที่เร็วกว่าการเดิน ไม่ใช่เพราะสัญญาณไม่ดี
   * ต้องแยกให้ขาด เพราะทางแก้ของสองเรื่องนี้ต่างกันคนละทาง
   */
  inVehicle?: boolean
}

/** แผงนำทางระหว่างเดินทาง — คำแนะนำถัดไป ระยะที่เหลือ และปุ่มควบคุม */
export function NavigationPanel({ nav, onRepeat, onFinish, onRetry, inVehicle = false }: Props) {
  const { t } = useTranslation()
  const { status, destination, progress, error, isOffRoute, isRecalculating } = nav

  if (status === 'error' && error) {
    return (
      <section
        id="navigation-panel"
        tabIndex={-1}
        aria-label={t('nav.calculating')}
        className="border-t-4 border-danger-500 bg-danger-500/10 p-4"
      >
        <p className="text-lg font-bold text-danger-600 dark:text-red-300">
          {t(`errors.${error.code}`, { meters: NAVIGATION_ACCURACY_M })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <BigButton variant="danger" onClick={onRetry} className="flex-1">
            {t('errors.retryButton')}
          </BigButton>
          <BigButton variant="secondary" onClick={nav.stop} className="flex-1">
            {t('nav.stopButton')}
          </BigButton>
        </div>
      </section>
    )
  }

  return (
    <section
      id="navigation-panel"
      tabIndex={-1}
      aria-label={
        destination
          ? t('nav.navigatingTo', { destination: destination.name })
          : t('nav.calculating')
      }
      className="border-t-2 border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      {/* คำแนะนำถัดไปคือข้อมูลที่สำคัญที่สุดบนหน้าจอนี้ ต้องประกาศทุกครั้งที่เปลี่ยน */}
      <p className="text-xl leading-snug font-bold">
        {status === 'calculating' && t('nav.calculating')}
        {status === 'arrived' &&
          (nav.arrivalOffset !== null && nav.arrivalOffset > ARRIVAL_RADIUS_M && destination
            ? t('nav.arrivedNearSpoken', {
                destination: destination.name,
                distance: formatDistance(nav.arrivalOffset),
              })
            : t('nav.arrived'))}
        {status === 'navigating' &&
          nav.suspended &&
          t(inVehicle ? 'nav.vehicleSpeed' : 'nav.paused')}
        {status === 'navigating' &&
          !nav.suspended &&
          (isRecalculating
            ? t('nav.recalculating')
            : !isOffRoute && progress?.nextStep && instructionText(t, progress))}
      </p>

      {nav.isMovingAway && !isOffRoute && status === 'navigating' && (
        <p className="mt-1 text-base font-bold text-danger-600 dark:text-red-300">
          {t('nav.movingAway')}
        </p>
      )}

      {isOffRoute && status === 'navigating' && (
        <p className="mt-1 text-base font-bold text-danger-600 dark:text-red-300">
          {t('nav.offRouteSpoken')}
        </p>
      )}

      {progress && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 text-base">
          <dt className="text-slate-600 dark:text-slate-300">{t('nav.remainingLabel')}</dt>
          <dd className="font-bold">{formatDistance(progress.remainingDistance)}</dd>
          <dt className="text-slate-600 dark:text-slate-300">{t('nav.etaLabel')}</dt>
          <dd className="font-bold">
            {t('nav.minutes', { count: Math.max(1, Math.round(progress.remainingDuration / 60)) })}
          </dd>
        </dl>
      )}

      {status === 'navigating' &&
        !nav.suspended &&
        !isOffRoute &&
        !isRecalculating &&
        progress &&
        progress.distanceToNextManeuver <= 25 &&
        progress.nextStep?.maneuver !== 'arrive' && (
          <BigButton variant="secondary" onClick={nav.confirmTurn}>
            {t('nav.confirmTurn')}
          </BigButton>
        )}

      {/*
        ถึงจุดหมายแล้วเหลือปุ่มเดียว และเป็นปุ่มหลักสีปกติ
        ไม่ใช่ปุ่มสีแดงที่สื่อว่ากำลังยกเลิกอะไรบางอย่าง เพราะการเดินทางสำเร็จแล้ว
        ส่วนปุ่มพูดคำแนะนำซ้ำไม่มีความหมายอีกต่อไป จึงเอาออกไม่ให้กดพลาด
      */}
      {status === 'arrived' ? (
        <BigButton onClick={onFinish} className="mt-3 w-full">
          {t('nav.finishButton')}
        </BigButton>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <BigButton variant="secondary" onClick={onRepeat} className="flex-1">
            {t('nav.repeatInstruction')}
          </BigButton>
          <BigButton variant="danger" onClick={nav.stop} className="flex-1">
            {t('nav.stopButton')}
          </BigButton>
        </div>
      )}
    </section>
  )
}
