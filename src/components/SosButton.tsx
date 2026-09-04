import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSpeech } from '@/hooks/useSpeech'
import { vibrate } from '@/utils/vibration'

/** ต้องกดค้างนานเท่านี้จึงจะส่งสัญญาณ — ยาวพอที่จะไม่ถูกกดโดนโดยบังเอิญในกระเป๋า */
const HOLD_DURATION_MS = 3000
const TICK_MS = 100

interface Props {
  onTrigger: () => void
  disabled?: boolean
  vibrationEnabled: boolean
}

/**
 * ปุ่มขอความช่วยเหลือฉุกเฉิน — ต้องกดค้าง 3 วินาที
 *
 * ทำไมต้องกดค้าง ไม่ใช่กดครั้งเดียว:
 * ผู้ใช้ที่มองไม่เห็นสำรวจหน้าจอด้วยการแตะ ปุ่มที่ทำงานทันทีจะถูกกดโดนโดยไม่ตั้งใจได้ง่ายมาก
 * และการแจ้งเตือนฉุกเฉินผิดพลาดสร้างความตื่นตระหนกให้คนที่ห่วงใยผู้ใช้
 *
 * ระหว่างกดค้างจะนับถอยหลังด้วยเสียงและการสั่นทุกวินาที ผู้ใช้จึงรู้ว่ากดติดแล้ว
 * และรู้ว่าเหลือเวลาอีกเท่าไรถ้าจะยกนิ้วเพื่อยกเลิก
 */
export function SosButton({ onTrigger, disabled = false, vibrationEnabled }: Props) {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const [heldMs, setHeldMs] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spokenSecondRef = useRef(-1)

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cancelHold = useCallback(() => {
    if (!isHolding) return
    stopTimer()
    setIsHolding(false)
    // ยกนิ้วก่อนครบเวลา = ตั้งใจยกเลิก ต้องยืนยันด้วยเสียงว่าไม่ได้ส่งอะไรออกไป
    if (heldMs > 0 && heldMs < HOLD_DURATION_MS) {
      speak(t('sos.cancelledSpoken'), { priority: 'critical' })
    }
    setHeldMs(0)
    spokenSecondRef.current = -1
  }, [heldMs, isHolding, speak, stopTimer, t])

  const startHold = useCallback(() => {
    if (disabled || isHolding) return
    setIsHolding(true)
    setHeldMs(0)
    spokenSecondRef.current = -1
    vibrate('tap', vibrationEnabled)
    speak(t('sos.holdingSpoken'), { priority: 'critical' })

    timerRef.current = setInterval(() => {
      setHeldMs((prev) => {
        const next = prev + TICK_MS
        if (next >= HOLD_DURATION_MS) {
          stopTimer()
          setIsHolding(false)
          onTrigger()
          return 0
        }
        // นับถอยหลังด้วยเสียงทีละวินาที: 3, 2, 1
        const remaining = Math.ceil((HOLD_DURATION_MS - next) / 1000)
        if (remaining !== spokenSecondRef.current) {
          spokenSecondRef.current = remaining
          vibrate('countdown', vibrationEnabled)
          speak(String(remaining), { priority: 'critical' })
        }
        return next
      })
    }, TICK_MS)
  }, [disabled, isHolding, onTrigger, speak, stopTimer, t, vibrationEnabled])

  useEffect(() => stopTimer, [stopTimer])

  const progress = Math.round((heldMs / HOLD_DURATION_MS) * 100)

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      // รองรับคีย์บอร์ด/สวิตช์: กดค้าง Enter หรือ Space ก็ได้ผลเดียวกัน
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          startHold()
        }
      }}
      onKeyUp={cancelHold}
      onBlur={cancelHold}
      aria-label={t('sos.buttonLabel')}
      aria-describedby="sos-hint"
      className="relative min-h-[5rem] w-full touch-none overflow-hidden rounded-2xl bg-danger-500 text-2xl font-bold text-white select-none disabled:opacity-50"
    >
      {/* แถบความคืบหน้าเป็นข้อมูลเสริมเชิงภาพ ข้อมูลจริงสื่อผ่านเสียงนับถอยหลังและการสั่น */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-danger-600 transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />
      <span className="relative">{isHolding ? t('sos.holding') : t('sos.button')}</span>
    </button>
  )
}
