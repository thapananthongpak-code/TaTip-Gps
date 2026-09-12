import { useEffect } from 'react'

/**
 * ทำให้ธีมของหน้าเว็บตามการตั้งค่าของเครื่อง
 *
 * ไม่มีตัวเลือกให้ผู้ใช้ตั้งเองแล้ว เพราะทุกตัวเลือกคือสิ่งที่ต้องเรียนรู้เพิ่ม
 * และคนที่ต้องการโหมดมืดหรือตัวอักษรใหญ่ ตั้งไว้ที่ระดับเครื่องอยู่แล้ว
 * ซึ่งมีผลกับทุกแอปที่เขาใช้ ไม่ใช่แค่แอปนี้
 *
 * ขนาดตัวอักษรฐานตั้งไว้ใหญ่กว่าเว็บทั่วไปใน CSS และทุกขนาดใช้หน่วย rem
 * การตั้งขนาดตัวอักษรของเบราว์เซอร์จึงขยายทั้งแอปได้เองอยู่แล้ว
 */
export function useAppearance() {
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      root.classList.toggle('dark', media.matches)
      // ให้ตัวควบคุมของระบบ เช่น scrollbar และช่องกรอก เข้าธีมตามไปด้วย
      root.style.colorScheme = media.matches ? 'dark' : 'light'
    }

    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])
}
