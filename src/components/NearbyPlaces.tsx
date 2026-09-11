import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseNearbyPlacesResult } from '@/hooks/useNearbyPlaces'
import { useSpeech } from '@/hooks/useSpeech'
import { mapService } from '@/services'
import type { GeoPosition, Place, PlaceCategory } from '@/types'
import { formatDistance } from '@/utils/format'
import { placeLabel } from '@/utils/places'
import { BigButton } from './BigButton'

/** เรียงตามความถี่ที่คนตาบอดต้องใช้จริง หมวดที่ใช้บ่อยที่สุดอยู่บนสุด */
const CATEGORIES: PlaceCategory[] = [
  'transit',
  'convenience',
  'toilets',
  'food',
  'pharmacy',
  'hospital',
  'bank',
  'government',
]

interface Props {
  nearby: UseNearbyPlacesResult
  position: GeoPosition | null
  onSelect: (place: Place) => void
  isOnline: boolean
}

/**
 * ค้นหาสถานที่รอบตัวด้วยปุ่มหมวดหมู่
 *
 * เพิ่มเข้ามาเพราะการค้นหาด้วยชื่ออย่างเดียวใช้ไม่ได้จริงกับผู้ใช้กลุ่มนี้:
 * คนตาบอดมองป้ายร้านไม่เห็น จึงไม่รู้ว่ารอบตัวมีอะไรให้เอาชื่อไปพิมพ์ค้นหา
 * ปุ่มหมวดหมู่เปลี่ยนคำถามจาก "ที่นั่นชื่ออะไร" เป็น "รอบตัวฉันมีอะไรบ้าง"
 */
export function NearbyPlaces({ nearby, position, onSelect, isOnline }: Props) {
  const { t } = useTranslation()
  const { speak } = useSpeech()
  const spokenFor = useRef<string | null>(null)

  // ประกาศผลด้วยเสียงหนึ่งครั้งต่อหนึ่งชุดผลลัพธ์
  useEffect(() => {
    if (!nearby.category || nearby.isLoading) return
    const key = `${nearby.category}|${nearby.radiusM}|${nearby.places.length}|${nearby.error?.code ?? ''}`
    if (spokenFor.current === key) return
    spokenFor.current = key

    const radius = formatDistance(nearby.radiusM)
    if (nearby.error) speak(t('nearby.unavailableSpoken'), { priority: 'critical' })
    else if (nearby.isEmpty) speak(t('nearby.noResultsSpoken', { radius }))
    else if (nearby.places.length > 0)
      speak(t('nearby.resultsSpoken', { count: nearby.places.length, radius }))
  }, [
    nearby.category,
    nearby.error,
    nearby.isEmpty,
    nearby.isLoading,
    nearby.places.length,
    nearby.radiusM,
    speak,
    t,
  ])

  return (
    <section aria-label={t('nearby.title')} className="nearby-panel">
      {/* ไม่มีคำอธิบายใต้หัวข้อ เพราะป้ายบนปุ่มบอกอยู่แล้วว่าแต่ละหมวดคืออะไร */}
      <h2>{t('nearby.title')}</h2>

      <div className="category-grid">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            disabled={!isOnline || !position || nearby.isLoading}
            aria-pressed={nearby.category === category}
            onClick={() => {
              speak(t('nearby.searchingSpoken'))
              nearby.find(category)
            }}
            className={
              nearby.category === category ? 'category-button is-active' : 'category-button'
            }
          >
            {t(`nearby.category.${category}`)}
          </button>
        ))}
      </div>

      {/* สถานะการค้นหา ประกาศให้ screen reader ทราบโดยไม่ต้องย้ายโฟกัส */}
      <p className="status-line">
        {nearby.isLoading && t('nearby.searching')}
        {!nearby.isLoading && nearby.error && t('nearby.unavailable')}
        {!nearby.isLoading &&
          !nearby.error &&
          nearby.isEmpty &&
          t('nearby.noResults', { radius: formatDistance(nearby.radiusM) })}
        {!nearby.isLoading &&
          !nearby.error &&
          nearby.places.length > 0 &&
          t('nearby.radiusLabel', { radius: formatDistance(nearby.radiusM) })}
      </p>

      {!nearby.isLoading && nearby.isEmpty && (
        <BigButton variant="secondary" onClick={nearby.widen}>
          {t('nearby.widen')}
        </BigButton>
      )}

      {nearby.places.length > 0 && (
        <ul aria-label={t('search.resultsLabel')} className="result-list">
          {nearby.places.map((place, index) => {
            const distance = position ? mapService.distanceBetween(position, place.location) : null
            return (
              <li key={place.id}>
                <button type="button" onClick={() => onSelect(place)} className="result-button">
                  <span className="result-index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>
                    <span className="result-name">{placeLabel(place, t)}</span>
                    <span className="result-meta">
                      {distance !== null && formatDistance(distance)}
                      {place.address && ` · ${place.address}`}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
