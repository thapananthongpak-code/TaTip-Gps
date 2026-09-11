import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { mapService } from '@/services'
import type { GeoPosition, Obstacle, Place, Route } from '@/types'
import { placeLabel } from '@/utils/places'
import { formatDistance } from '@/utils/format'
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
  /** ผลการค้นหาที่จะปักหมุดพร้อมหมายเลขตรงกับลำดับในรายการ */
  results?: Place[]
  /** สิ่งกีดขวางบนเส้นทาง */
  obstacles?: Obstacle[]
  /** เลือกจุดหมายจากหมุดบนแผนที่ */
  onSelectResult?: (place: Place) => void
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
  // ไม่ให้เป็นปุ่มโฟกัสได้ เพราะไม่มีอะไรให้กด (ดูเหตุผลเต็มใน CurrentPositionMarker)
  return (
    <Marker
      position={destination.location}
      icon={icon}
      alt={destination.name}
      interactive={false}
      keyboard={false}
    />
  )
}

/**
 * หมุดผลการค้นหา มีเลขกำกับตรงกับลำดับในรายการด้านล่าง
 * เลขช่วยให้คนสายตาเลือนรางและคนช่วยเหลือที่มองเห็น อ้างอิงถึงรายการเดียวกันได้
 */
function ResultMarkers({
  results,
  onSelect,
}: {
  results: Place[]
  onSelect?: (place: Place) => void
}) {
  const { t } = useTranslation()

  return (
    <>
      {results.map((place, index) => {
        const markerLabel = t('map.resultMarker', {
          index: index + 1,
          name: placeLabel(place, t),
        })
        return (
          <Marker
            key={place.id}
            position={place.location}
            alt={markerLabel}
            icon={L.divIcon({
              className: '',
              // หมุดนี้กดได้จริง Leaflet จึงทำให้เป็น role="button" ให้เอง
              // แต่ปุ่มต้องมีชื่อ จึงฝังข้อความสำหรับ screen reader ไว้ข้างใน
              // (Leaflet ใช้ alt กับไอคอนที่เป็นรูปเท่านั้น ไม่ใช้กับ divIcon)
              html: `<span style="display:flex;align-items:center;justify-content:center;
                width:28px;height:28px;border-radius:9999px;background:#0f52ab;color:#fff;
                border:3px solid #fff;box-shadow:0 0 0 2px #0f52ab;font:700 15px/1 system-ui;
              ">${index + 1}<span class="sr-only-live">${markerLabel}</span></span>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            })}
            eventHandlers={onSelect ? { click: () => onSelect(place) } : undefined}
          />
        )
      })}
    </>
  )
}

/**
 * หมุดสิ่งกีดขวาง — สีส้มสำหรับที่ต้องระวังเป็นพิเศษ (บันได เขตก่อสร้าง)
 * และสีเทาเข้มสำหรับที่เหลือ เพื่อให้กวาดตาเห็นจุดอันตรายก่อน
 */
function ObstacleMarkers({ obstacles }: { obstacles: Obstacle[] }) {
  const { t } = useTranslation()

  return (
    <>
      {obstacles.map((obstacle) => {
        const color = obstacle.severity === 'high' ? '#b45309' : '#475569'
        return (
          <Marker
            key={obstacle.id}
            position={obstacle.location}
            alt={t('map.obstacleMarker', {
              label: t(`obstacle.label.${obstacle.kind}`),
              distance: formatDistance(obstacle.distanceFromStartM),
            })}
            icon={L.divIcon({
              className: '',
              html: `<span style="display:flex;align-items:center;justify-content:center;
                  width:22px;height:22px;background:${color};color:#fff;border:3px solid #fff;
                  box-shadow:0 0 0 2px ${color};font:700 13px/1 system-ui;
                  clip-path:polygon(50% 0%,100% 100%,0% 100%);
                ">!</span>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            })}
            interactive={false}
            keyboard={false}
          />
        )
      })}
    </>
  )
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
export function MapView({
  position,
  isPoorAccuracy,
  isStale,
  follow,
  onUserPan,
  route,
  results = [],
  obstacles = [],
  onSelectResult,
}: Props) {
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
        {obstacles.length > 0 && <ObstacleMarkers obstacles={obstacles} />}
        {results.length > 0 && <ResultMarkers results={results} onSelect={onSelectResult} />}
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
