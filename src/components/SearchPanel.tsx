import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearch } from '@/hooks/useSearch'
import { useSpeech } from '@/hooks/useSpeech'
import { mapService } from '@/services'
import type { GeoPosition, Place } from '@/types'
import { formatDistance } from '@/utils/format'
import { BigButton } from './BigButton'

interface Props {
  position: GeoPosition | null
  onSelect: (place: Place) => void
  /** ค้นหาต้องใช้อินเทอร์เน็ต ตอนออฟไลน์จึงปิดช่องกรอกและบอกเหตุผลให้ชัด */
  isOnline: boolean
}

/** ช่องค้นหาจุดหมาย + รายการผลลัพธ์ที่กดเลือกได้ */
export function SearchPanel({ position, onSelect, isOnline }: Props) {
  const { t } = useTranslation()
  const inputId = useId()
  const { query, setQuery, results, isSearching, error, isEmpty, clear, search } =
    useSearch(position)
  const { speak } = useSpeech()
  const spokenForRef = useRef<string | null>(null)

  // ประกาศผลลัพธ์ด้วยเสียงหนึ่งครั้งต่อหนึ่งชุดผลลัพธ์
  useEffect(() => {
    if (isSearching) return
    const key = `${query}|${results.length}|${isEmpty}|${error?.code ?? ''}`
    if (spokenForRef.current === key) return
    if (query.trim().length < 2) return
    spokenForRef.current = key

    if (error) speak(t(`errors.${error.code}_SPOKEN`), { priority: 'critical' })
    else if (isEmpty) speak(t('search.noResultsSpoken'))
    else if (results.length > 0) speak(t('search.resultsSpoken', { count: results.length }))
  }, [error, isEmpty, isSearching, query, results.length, speak, t])

  return (
    <section aria-label={t('search.label')} className="search-panel">
      <label htmlFor={inputId}>
        <h2>{t('search.label')}</h2>
      </label>

      <form
        className="search-form mt-2 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (isOnline) search()
        }}
      >
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          disabled={!isOnline}
          aria-describedby={`${inputId}-hint`}
          autoComplete="off"
          className="search-input"
        />
        {query && (
          <BigButton variant="secondary" onClick={clear} aria-label={t('search.clear')}>
            ✕
          </BigButton>
        )}
        <BigButton type="submit" disabled={!isOnline || isSearching || query.trim().length < 2}>
          {t('search.submit')}
        </BigButton>
      </form>

      <p id={`${inputId}-hint`} className="hint">
        {isOnline ? t('search.hint') : t('offline.searchUnavailable')}
      </p>

      {/* ประกาศสถานะการค้นหาให้ screen reader โดยไม่ต้องย้ายโฟกัส */}
      <p className="status-line">
        {!isOnline && t('offline.searchUnavailable')}
        {isOnline && isSearching && t('search.searching')}
        {isOnline && !isSearching && error && t(`errors.${error.code}`)}
        {isOnline && !isSearching && !error && isEmpty && t('search.noResults')}
      </p>

      {results.length > 0 && (
        <ul aria-label={t('search.resultsLabel')} className="result-list">
          {results.map((place) => {
            const distance = position ? mapService.distanceBetween(position, place.location) : null
            return (
              <li key={place.id}>
                <button type="button" onClick={() => onSelect(place)} className="result-button">
                  <span>
                    <span className="result-name">{place.name}</span>
                    <span className="result-meta">
                      {distance !== null && `${formatDistance(distance)} · `}
                      {place.address}
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
