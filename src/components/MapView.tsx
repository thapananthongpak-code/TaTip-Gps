import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { mapService } from '@/services'
import type { GeoPosition, Route } from '@/types'
import { CurrentPositionMarker } from './CurrentPositionMarker'

interface Props {
  position: GeoPosition | null
  isPoorAccuracy: boolean
  isStale: boolean
  /** true = แผนที่เลื่อนตามผู้ใช้อัตโนมัติ */
  follow: boolean
  /** แจ้งกลับเมื่อผู้ใช้ลากแผนที่เอง เพื่อปิดโหมดตาม */
  onUserPan: () => void
  /** เส้นทางที่กำลังนำทางอยู่ (ถ้ามี) */
  route: Route | null
}

/** หมุดจุดหมายปลายทาง */
function DestinationMarker({ destination }: { destination: Route['destination'] }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `<span style="
            display:block;width:20px;height:20px;border-radius:9999px;
            background:#1b7f3b;border:4px solid #fff;box-shadow:0 0 0 2px #1b7f3b;
          "></span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    [],
  )
  return <Marker position={destination.location} icon={icon} alt={destination.name} />
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
export function MapView({ position, isPoorAccuracy, isStale, follow, onUserPan, route }: Props) {
  const { t } = useTranslation()
  const tiles = mapService.getTileConfig()
  const fallbackCenter = mapService.getDefaultCenter()
  const center = position ?? fallbackCenter

  return (
    // ต้องครอบด้วย div ที่มี label เอง เพราะ MapContainer ของ react-leaflet
    // ไม่ส่ง aria-* ต่อไปยัง element จริง (ดู MapContainerProps)
    // แผนที่เป็นข้อมูลเชิงภาพเสริม ข้อมูลหลักทั้งหมดอยู่ในแผงสถานะที่อ่านออกเสียงได้
    <div role="region" aria-label={t('map.label')} className="h-full w-full">
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
        {route && (
          <>
            {/* เส้นขอบขาวด้านหลังช่วยให้เส้นทางยังอ่านออกบนพื้นแผนที่ทุกสี (contrast) */}
            <Polyline positions={route.geometry} pathOptions={{ color: '#ffffff', weight: 12 }} />
            <Polyline positions={route.geometry} pathOptions={{ color: '#0f52ab', weight: 6 }} />
            <DestinationMarker destination={route.destination} />
          </>
        )}
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
