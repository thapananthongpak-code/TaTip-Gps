import L from 'leaflet'
import { useMemo } from 'react'
import { Circle, Marker } from 'react-leaflet'
import { msg } from '@/i18n/messages'
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
      <Marker position={position} icon={icon} alt={msg.map.youAreHereMarker} />
    </>
  )
}
