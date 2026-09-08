import { useEffect, useState } from 'react'
import { shareService } from '@/services'
import type { SharePayload } from '@/types'

/**
 * ตรวจว่า URL ปัจจุบันเป็นลิงก์แชร์ตำแหน่งหรือไม่
 *
 * ใช้ hash routing แทนการเพิ่มไลบรารี router เพราะแอปมีแค่สองหน้า
 * และข้อมูลตำแหน่งต้องอยู่หลัง # อยู่แล้ว เพื่อไม่ให้ถูกส่งไปยังเซิร์ฟเวอร์
 */
export function useShareRoute() {
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  )

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const [, refresh] = useState(0)
  useEffect(() => {
    if (!hash.startsWith('#/share/')) return
    const tick = () => refresh((value) => value + 1)
    const timer = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [hash])
  const isShareView = hash.startsWith('#/share/')
  const payload: SharePayload | null = isShareView
    ? shareService.parseShareUrl(window.location.href)
    : null

  return { isShareView, payload }
}
