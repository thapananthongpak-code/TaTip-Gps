import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700',
  secondary:
    'bg-white text-slate-900 border-2 border-slate-400 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-50 dark:border-slate-500 dark:hover:bg-slate-700',
  danger: 'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-600',
}

/**
 * ปุ่มมาตรฐานของแอป
 * บังคับ touch target อย่างน้อย 48px ตามเกณฑ์ WCAG เพราะผู้ใช้กลุ่มเป้าหมาย
 * แตะโดยไม่เห็นตำแหน่งปุ่ม ปุ่มเล็กจะพลาดง่ายมาก
 */
export function BigButton({ variant = 'primary', className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`min-h-touch min-w-touch cursor-pointer rounded-2xl px-5 py-3 text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
