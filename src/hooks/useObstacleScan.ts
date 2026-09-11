import { useEffect, useState } from 'react'
import { currentLanguage } from '@/i18n'
import { obstacleService } from '@/services'
import type { Obstacle, ObstacleKind, ObstacleReport, Route } from '@/types'

const EMPTY_REPORT: ObstacleReport = { obstacles: [], countsByKind: {}, failed: false }

function summarise(obstacles: Obstacle[], failed: boolean): ObstacleReport {
  const countsByKind: Partial<Record<ObstacleKind, number>> = {}
  for (const obstacle of obstacles) {
    countsByKind[obstacle.kind] = (countsByKind[obstacle.kind] ?? 0) + 1
  }
  return { obstacles, countsByKind, failed }
}

/**
 * สแกนสิ่งกีดขวางของเส้นทางหนึ่งครั้งตอนได้เส้นทางใหม่
 *
 * สแกนครั้งเดียวต่อเส้นทาง ไม่สแกนซ้ำระหว่างเดิน เพราะข้อมูลบันไดและเสากั้น
 * ไม่เปลี่ยนระหว่างที่เดินอยู่ และการยิง Overpass ซ้ำๆ จะทำให้โดนบล็อก
 *
 * ⚠️ `failed` ต่างจาก "ไม่พบสิ่งกีดขวาง" อย่างสิ้นเชิง และต้องแยกให้ขาดในทุกชั้น
 * ถ้าสแกนไม่สำเร็จแล้วไปบอกผู้ใช้ว่า "เส้นทางนี้ไม่มีสิ่งกีดขวาง"
 * เท่ากับหลอกให้เขาเดินอย่างมั่นใจบนเส้นทางที่ยังไม่เคยตรวจเลย
 */
export function useObstacleScan(route: Route | null, enabled: boolean) {
  // เก็บผลคู่กับ id ของเส้นทางที่สแกน เพื่อให้รู้ได้ทันทีว่าผลที่ถืออยู่
  // เป็นของเส้นทางปัจจุบันหรือของเส้นทางเก่าที่เพิ่งถูกแทนที่
  const [scanned, setScanned] = useState<{ routeId: string; report: ObstacleReport } | null>(null)
  const routeId = route?.id ?? null

  useEffect(() => {
    if (!enabled || !route || route.geometry.length === 0) return

    const controller = new AbortController()
    let cancelled = false
    const id = route.id

    obstacleService
      .scanRoute(route.geometry, { language: currentLanguage(), signal: controller.signal })
      .then((obstacles) => {
        if (!cancelled) setScanned({ routeId: id, report: summarise(obstacles, false) })
      })
      .catch(() => {
        // บอกตรงๆ ว่าตรวจไม่ได้ ดีกว่าเงียบแล้วปล่อยให้เข้าใจว่าปลอดภัย
        if (!cancelled) setScanned({ routeId: id, report: summarise([], true) })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [route, enabled])

  const isCurrent = routeId !== null && scanned?.routeId === routeId
  return {
    report: isCurrent ? scanned.report : EMPTY_REPORT,
    isScanning: Boolean(enabled && routeId && !isCurrent),
  }
}
