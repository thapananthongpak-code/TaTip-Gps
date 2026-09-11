import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { vibrate } from '@/utils/vibration'

interface Props {
  onTrigger: () => void
  disabled?: boolean
}

/** Holding prepares a confirmation dialog; activation by assistive technology does too. */
export function SosButton({ onTrigger, disabled = false }: Props) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const startTime = useRef(0)
  const triggered = useRef(false)
  const cancel = useCallback(() => {
    clearInterval(timer.current)
    timer.current = undefined
    setProgress(0)
  }, [])
  const start = () => {
    if (disabled || timer.current !== undefined) return
    triggered.current = false
    startTime.current = performance.now()
    vibrate('tap')
    timer.current = setInterval(() => {
      const elapsed = performance.now() - startTime.current
      if (elapsed >= 3000) {
        triggered.current = true
        cancel()
        onTrigger() // Never perform side effects inside a React state updater.
      } else setProgress(elapsed / 30)
    }, 100)
  }
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) cancel()
    }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      clearInterval(timer.current)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [cancel])
  return (
    <button
      type="button"
      className="sos-button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onBlur={cancel}
      onClick={() => {
        if (!triggered.current) onTrigger()
        triggered.current = false
      }}
      aria-label={t('sos.buttonLabel')}
    >
      <span aria-hidden="true" className="sos-progress" style={{ width: progress + '%' }} />
      <span className="relative">{t('sos.button')}</span>
    </button>
  )
}
