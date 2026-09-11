import L from 'leaflet'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Circle, Marker } from 'react-leaflet'
import type { GeoPosition } from '@/types'

interface Props {
  position: GeoPosition
  isPoorAccuracy: boolean
  isStale: boolean
}

/**
 * หมุดตำแหน่งปัจจุบัน + วงกลมแสดงความคลาดเคลื่อน
 *
 * ใช้ divIcon แทนไฟล์รูป marker ของ Leaflet เพราะ:
 * - เลี่ยงปัญหา path ของ marker-icon.png ตอน bundle ด้วย Vite
 * - เปลี่ยนสีตามคุณภาพสัญญาณได้ (แม่นยำ = น้ำเงิน, อ่อน/ค้าง = ส้ม)
 */
export function CurrentPositionMarker({ position, isPoorAccuracy, isStale }: Props) {
  const { t } = useTranslation()
  const degraded = isPoorAccuracy || isStale
  const color = degraded ? '#c2620b' : '#1668d6'

  const icon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `<span style="
            display:block;width:22px;height:22px;border-radius:9999px;
            background:${color};border:4px solid #fff;
            box-shadow:0 0 0 2px ${color}, 0 2px 6px rgba(0,0,0,.4);
          "></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    [color],
  )

  return (
    <>
      <Circle
        center={position}
        radius={position.accuracy}
        pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.15 }}
        // วงความคลาดเคลื่อนเป็นข้อมูลเสริมเชิงภาพ ไม่ต้องให้ screen reader อ่าน
        interactive={false}
      />
      {/*
        interactive/keyboard = false เพราะหมุดนี้ไม่มีอะไรให้กด
        ถ้าปล่อยค่าเริ่มต้นไว้ Leaflet จะทำให้เป็น role="button" ที่โฟกัสได้แต่ไม่มีชื่อ
        ผู้ใช้ screen reader จะเจอปุ่มเปล่าที่กดแล้วไม่เกิดอะไรขึ้น
        ข้อมูลตำแหน่งทั้งหมดมีอยู่ในแผงสถานะที่อ่านออกเสียงได้อยู่แล้ว
      */}
      <Marker
        position={position}
        icon={icon}
        alt={t('map.youAreHereMarker')}
        interactive={false}
        keyboard={false}
      />
    </>
  )
}
