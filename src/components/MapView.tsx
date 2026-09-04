import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { msg } from '@/i18n/messages'
import { mapService } from '@/services'
import type { GeoPosition } from '@/types'
import { CurrentPositionMarker } from './CurrentPositionMarker'

interface Props {
  position: GeoPosition | null
  isPoorAccuracy: boolean
  isStale: boolean
  /** true = แผนที่เลื่อนตามผู้ใช้อัตโนมัติ */
  follow: boolean
  /** แจ้งกลับเมื่อผู้ใช้ลากแผนที่เอง เพื่อปิดโหมดตาม */
  onUserPan: () => void
}

/** เลื่อนแผนที่ตามตำแหน่งผู้ใช้เมื่ออยู่ในโหมด follow */
function FollowController({ position, follow }: { position: GeoPosition | null; follow: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (!follow || !position) return
    map.setView([position.lat, position.lng], map.getZoom(), { animate: true })
  }, [map, follow, position])

  return null
}

/** ผู้ใช้ลาก/ซูมเอง = ตั้งใจดูที่อื่น ให้หยุดตามตำแหน่งอัตโนมัติ */
function UserPanWatcher({ onUserPan }: { onUserPan: () => void }) {
  useMapEvents({
    dragstart: onUserPan,
  })
  return null
}

/**
 * แผนที่ OpenStreetMap ผ่าน Leaflet
 * ค่า tile/zoom/ศูนย์กลางมาจาก mapService ไม่ hardcode ที่นี่
 * เพื่อให้เปลี่ยนผู้ให้บริการแผนที่ได้โดยไม่ต้องแก้ component
 */
export function MapView({ position, isPoorAccuracy, isStale, follow, onUserPan }: Props) {
  const tiles = mapService.getTileConfig()
  const fallbackCenter = mapService.getDefaultCenter()
  const center = position ?? fallbackCenter

  return (
    // ต้องครอบด้วย div ที่มี label เอง เพราะ MapContainer ของ react-leaflet
    // ไม่ส่ง aria-* ต่อไปยัง element จริง (ดู MapContainerProps)
    // แผนที่เป็นข้อมูลเชิงภาพเสริม ข้อมูลหลักทั้งหมดอยู่ในแผงสถานะที่อ่านออกเสียงได้
    <div role="region" aria-label={msg.map.label} className="h-full w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={mapService.getDefaultZoom()}
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url={tiles.urlTemplate}
          attribution={tiles.attribution}
          maxZoom={tiles.maxZoom}
        />
        <FollowController position={position} follow={follow} />
        <UserPanWatcher onUserPan={onUserPan} />
        {position && (
          <CurrentPositionMarker
            position={position}
            isPoorAccuracy={isPoorAccuracy}
            isStale={isStale}
          />
        )}
      </MapContainer>
    </div>
  )
}
