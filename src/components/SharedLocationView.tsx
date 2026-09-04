import { useTranslation } from 'react-i18next'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { useMemo } from 'react'
import { mapService } from '@/services'
import type { SharePayload } from '@/types'
import { formatDistance } from '@/utils/format'

interface Props {
  payload: SharePayload | null
}

function dotIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:${color};border:4px solid #fff;box-shadow:0 0 0 2px ${color};"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

/**
 * หน้าสำหรับ "ผู้รับ" ลิงก์แชร์ตำแหน่ง
 *
 * ตั้งใจเขียนให้ตรงไปตรงมาว่าข้อมูลที่เห็นเป็นตำแหน่ง ณ เวลาที่ผู้ใช้กดส่ง
 * ไม่ใช่ตำแหน่งสด — ถ้าคนดูเข้าใจผิดว่าเป็นเรียลไทม์แล้วเห็นหมุดไม่ขยับ
 * อาจนิ่งนอนใจทั้งที่ผู้ใช้กำลังต้องการความช่วยเหลือ
 */
export function SharedLocationView({ payload }: Props) {
  const { t } = useTranslation()
  const tiles = mapService.getTileConfig()
  const userIcon = useMemo(() => dotIcon('#1668d6'), [])
  const destIcon = useMemo(() => dotIcon('#1b7f3b'), [])

  if (!payload) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-bold">{t('sharedView.expiredTitle')}</h1>
        <p className="max-w-md text-lg">{t('sharedView.expiredBody')}</p>
      </div>
    )
  }

  const capturedAt = new Date(payload.capturedAt)
  const expiresAt = new Date(payload.expiresAt)

  return (
    <div className="flex h-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="bg-brand-600 px-4 py-3 text-white">
        <h1 className="text-xl font-bold">{t('sharedView.title')}</h1>
      </header>

      <div className="flex-1">
        <MapContainer
          center={[payload.position.lat, payload.position.lng]}
          zoom={17}
          className="h-full w-full"
        >
          <TileLayer
            url={tiles.urlTemplate}
            attribution={tiles.attribution}
            maxZoom={tiles.maxZoom}
          />
          <Marker position={payload.position} icon={userIcon} />
          {payload.destination && (
            <Marker position={payload.destination.location} icon={destIcon} />
          )}
        </MapContainer>
      </div>

      <section className="border-t-2 border-slate-300 p-4 dark:border-slate-700">
        <p role="alert" className="rounded-xl bg-amber-100 p-3 text-base text-amber-950">
          {t('sharedView.snapshotWarning')}
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-base">
          <dt className="text-slate-600 dark:text-slate-300">{t('sharedView.capturedAt')}</dt>
          <dd className="font-bold">{capturedAt.toLocaleString()}</dd>

          <dt className="text-slate-600 dark:text-slate-300">{t('gps.accuracyLabel')}</dt>
          <dd className="font-bold">±{formatDistance(payload.accuracy)}</dd>

          <dt className="text-slate-600 dark:text-slate-300">{t('sharedView.expiresAt')}</dt>
          <dd className="font-bold">{expiresAt.toLocaleString()}</dd>

          {payload.destination && (
            <>
              <dt className="text-slate-600 dark:text-slate-300">{t('sharedView.destination')}</dt>
              <dd className="font-bold">{payload.destination.name}</dd>
            </>
          )}
        </dl>

        <a
          href={`https://www.openstreetmap.org/?mlat=${payload.position.lat}&mlon=${payload.position.lng}#map=18/${payload.position.lat}/${payload.position.lng}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex min-h-touch items-center justify-center rounded-2xl border-2 border-slate-500 px-4 py-3 text-lg font-bold dark:border-slate-400"
        >
          {t('sharedView.openInMaps')}
        </a>
      </section>
    </div>
  )
}
