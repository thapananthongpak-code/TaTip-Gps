import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mapService } from '@/services'
import type { GeoPosition, Obstacle, Place, Route } from '@/types'
import { formatDistance } from '@/utils/format'
import { loadGoogleMaps } from '@/utils/googleMapsLoader'

export interface MapViewProps {
  position: GeoPosition | null
  isPoorAccuracy: boolean
  isStale: boolean
  follow: boolean
  onUserPan: () => void
  route: Route | null
  results?: Place[]
  obstacles?: Obstacle[]
  onSelectResult?: (place: Place) => void
}

/** วงกลมสีเดียว วาดเป็น SVG แทนการโหลดไฟล์รูป เพื่อไม่ให้มีคำขอเพิ่มระหว่างเดิน */
function dot(fill: string, size: number, label?: string) {
  const half = size / 2
  const text = label
    ? `<text x="${half}" y="${half + 5}" text-anchor="middle" font-family="system-ui" font-size="15" font-weight="700" fill="#fff">${label}</text>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${half}" cy="${half}" r="${half - 4}" fill="${fill}" stroke="#fff" stroke-width="3"/>${text}
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

/**
 * แผนที่บน Google Maps JavaScript API
 *
 * มีคู่กับรุ่น Leaflet ไม่ได้มาแทนที่ เพราะแอปต้องเปิดได้เมื่อยังไม่ได้ตั้งค่าคีย์
 * และเพราะข้อกำหนดของ Google บังคับว่าข้อมูล Places/Routes ต้องแสดงบนแผนที่ของ Google
 * เมื่อไหร่ที่เปลี่ยนไปใช้ Google สำหรับค้นหาและเส้นทาง แผนที่ต้องเปลี่ยนตามด้วย
 *
 * ⚠️ แผนที่เป็นข้อมูลเสริมเชิงภาพเท่านั้น ข้อมูลทุกอย่างที่จำเป็นต่อการเดินทาง
 * ถูกพูดออกเสียงและอยู่ในแผงที่โปรแกรมอ่านหน้าจออ่านได้อยู่แล้ว
 * ถ้าแผนที่โหลดไม่ขึ้น การนำทางต้องยังทำงานได้ครบ
 */
export function GoogleMapView({
  position,
  isPoorAccuracy,
  isStale,
  follow,
  onUserPan,
  route,
  results = [],
  obstacles = [],
  onSelectResult,
}: MapViewProps) {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const [failed, setFailed] = useState(false)

  // เก็บสิ่งที่วาดไว้เพื่อลบทิ้งตอนข้อมูลเปลี่ยน — Google ไม่ได้จัดการให้เหมือน React
  const drawn = useRef<{ setMap: (map: google.maps.Map | null) => void }[]>([])
  const selfMarkers = useRef<{ setMap: (map: google.maps.Map | null) => void }[]>([])

  // ---- สร้างแผนที่ครั้งเดียว ----
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !hostRef.current || mapRef.current) return
        const start = mapService.getDefaultCenter()
        mapRef.current = new maps.Map(hostRef.current, {
          center: { lat: start.lat, lng: start.lng },
          zoom: mapService.getDefaultZoom(),
          disableDefaultUI: true,
          // ปุ่มของ Google เล็กกว่าเกณฑ์การแตะของแอปนี้มาก จึงปิดทั้งหมด
          // แล้วใช้ปุ่มขนาดใหญ่ของแอปเองที่อยู่ใต้แผนที่แทน
          gestureHandling: 'greedy',
          clickableIcons: false,
          keyboardShortcuts: false,
        })
        mapRef.current.addListener('dragstart', onUserPan)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [onUserPan])

  // ---- เลื่อนตามผู้ใช้ ----
  useEffect(() => {
    if (!follow || !position || !mapRef.current) return
    mapRef.current.panTo({ lat: position.lat, lng: position.lng })
  }, [follow, position])

  // ---- เส้นทาง หมุดผลค้นหา และสิ่งกีดขวาง ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return
    const maps = window.google.maps

    drawn.current.forEach((item) => item.setMap(null))
    drawn.current = []

    if (route) {
      // เส้นขาวหนาด้านหลังทำให้เส้นทางยังอ่านออกบนพื้นแผนที่ทุกสี
      for (const [color, weight] of [
        ['#ffffff', 12],
        ['#0f52ab', 6],
      ] as const) {
        const line = new maps.Polyline({
          path: route.geometry,
          strokeColor: color,
          strokeWeight: weight,
          strokeOpacity: 1,
          clickable: false,
          map,
        })
        drawn.current.push(line)
      }

      drawn.current.push(
        new maps.Marker({
          position: route.destination.location,
          map,
          clickable: false,
          title: route.destination.name,
          icon: { url: dot('#1b7f3b', 20), anchor: new maps.Point(10, 10) },
        }),
      )
    }

    for (const obstacle of obstacles) {
      drawn.current.push(
        new maps.Marker({
          position: obstacle.location,
          map,
          clickable: false,
          title: t('map.obstacleMarker', {
            label: t(`obstacle.label.${obstacle.kind}`),
            distance: formatDistance(obstacle.distanceFromStartM),
          }),
          icon: {
            url: dot(obstacle.severity === 'high' ? '#b45309' : '#475569', 22, '!'),
            anchor: new maps.Point(11, 11),
          },
        }),
      )
    }

    results.forEach((place, index) => {
      const label = t('map.resultMarker', { index: index + 1, name: place.name })
      const marker = new maps.Marker({
        position: place.location,
        map,
        title: label,
        icon: { url: dot('#0f52ab', 28, String(index + 1)), anchor: new maps.Point(14, 14) },
      })
      if (onSelectResult) marker.addListener('click', () => onSelectResult(place))
      drawn.current.push(marker)
    })
  }, [route, results, obstacles, onSelectResult, t])

  // ---- ตำแหน่งผู้ใช้ พร้อมวงรัศมีความคลาดเคลื่อน ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return
    const maps = window.google.maps

    selfMarkers.current.forEach((item) => item.setMap(null))
    selfMarkers.current = []
    if (!position) return

    /*
     * สีบอกว่าเชื่อตำแหน่งนี้ได้แค่ไหน ตรงกับข้อความในแผงสถานะ
     * เทา = สัญญาณค้าง, ส้ม = คลาดเคลื่อนมาก, น้ำเงิน = ปกติ
     */
    const color = isStale ? '#64748b' : isPoorAccuracy ? '#b45309' : '#0f52ab'
    const at = { lat: position.lat, lng: position.lng }

    selfMarkers.current.push(
      new maps.Circle({
        center: at,
        radius: position.accuracy,
        map,
        clickable: false,
        strokeColor: color,
        strokeOpacity: 0.5,
        strokeWeight: 1,
        fillColor: color,
        fillOpacity: 0.15,
      }),
      new maps.Marker({
        position: at,
        map,
        clickable: false,
        title: t('map.youAreHereMarker'),
        icon: { url: dot(color, 18), anchor: new maps.Point(9, 9) },
      }),
    )
  }, [position, isPoorAccuracy, isStale, t])

  // ล้างทุกอย่างตอนถอด component ไม่งั้น marker ค้างอยู่ในหน่วยความจำ
  useEffect(
    () => () => {
      drawn.current.forEach((item) => item.setMap(null))
      selfMarkers.current.forEach((item) => item.setMap(null))
    },
    [],
  )

  return (
    <div role="region" aria-label={t('map.label')} className="h-full w-full">
      {failed ? (
        // บอกตรงๆ ว่าแผนที่ใช้ไม่ได้ ดีกว่าปล่อยกล่องเทาว่างๆ ให้เดาเอง
        <p className="status-line">{t('map.unavailable')}</p>
      ) : (
        <div ref={hostRef} className="h-full w-full" />
      )}
    </div>
  )
}
