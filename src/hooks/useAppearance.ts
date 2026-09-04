import { useEffect } from 'react'
import type { AppSettings, FontScale } from '@/types'

/**
 * ขนาดตัวอักษรฐานของแต่ละระดับ
 *
 * ทุกขนาดในแอปเขียนด้วยหน่วย rem การเปลี่ยนค่าฐานตรงนี้จึงขยายทั้งแอปพร้อมกัน
 * รวมถึงระยะห่างและขนาดปุ่ม ทำให้ยังกดถูกอยู่เมื่อขยายตัวอักษร
 */
const FONT_SIZES: Record<FontScale, string> = {
  normal: '18px',
  large: '21px',
  'x-large': '25px',
}

/**
 * ใช้ค่าหน้าตาที่ผู้ใช้เลือก (ขนาดตัวอักษร + ธีม) กับเอกสารทั้งหน้า
 *
 * เลือกคำนวณธีมที่ใช้จริงด้วย JavaScript แล้วใส่คลาส `dark` เอง
 * แทนการพึ่ง prefers-color-scheme อย่างเดียว เพราะผู้ใช้ต้องเลือกทับค่าของเครื่องได้
 * (บางคนสายตาเลือนรางอ่านโหมดสว่างชัดกว่า แม้เครื่องจะตั้งเป็นโหมดมืด)
 */
export function useAppearance(settings: AppSettings) {
  const { fontScale, theme } = settings

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[fontScale]
  }, [fontScale])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches)
      root.classList.toggle('dark', isDark)
      // ให้ตัวควบคุมของระบบ (เช่น scrollbar, ช่องกรอกข้อมูล) เข้าธีมตามไปด้วย
      root.style.colorScheme = isDark ? 'dark' : 'light'
    }

    apply()
    // ตามการเปลี่ยนธีมของเครื่องเฉพาะตอนที่ผู้ใช้เลือกโหมด "ตามระบบ"
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
