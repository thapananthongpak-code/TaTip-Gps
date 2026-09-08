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
    <section
      aria-label={t('search.label')}
      className="border-t-2 border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <label htmlFor={inputId} className="block text-lg font-bold">
        {t('search.label')}
      </label>

      <form
        className="mt-2 flex flex-wrap gap-2"
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
          className="min-h-touch min-w-0 flex-1 rounded-xl border-2 border-slate-500 px-4 py-3 text-lg dark:border-slate-400 dark:bg-slate-800"
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

      <p id={`${inputId}-hint`} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {isOnline ? t('search.hint') : t('offline.searchUnavailable')}
      </p>

      {/* ประกาศสถานะการค้นหาให้ screen reader โดยไม่ต้องย้ายโฟกัส */}
      <p className="mt-2 text-base font-bold">
        {!isOnline && t('offline.searchUnavailable')}
        {isOnline && isSearching && t('search.searching')}
        {isOnline && !isSearching && error && t(`errors.${error.code}`)}
        {isOnline && !isSearching && !error && isEmpty && t('search.noResults')}
      </p>

      {results.length > 0 && (
        <ul aria-label={t('search.resultsLabel')} className="mt-2 flex flex-col gap-2">
          {results.map((place) => {
            const distance = position ? mapService.distanceBetween(position, place.location) : null
            return (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => onSelect(place)}
                  className="min-h-touch w-full cursor-pointer rounded-xl border-2 border-slate-500 p-3 text-left hover:bg-slate-100 dark:border-slate-400 dark:hover:bg-slate-800"
                >
                  <span className="block text-lg font-bold">{place.name}</span>
                  <span className="block text-sm text-slate-600 dark:text-slate-300">
                    {distance !== null && `${formatDistance(distance)} · `}
                    {place.address}
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
