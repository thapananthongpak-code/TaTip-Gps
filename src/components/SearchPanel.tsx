import { useEffect, useId, useRef } from 'react'
import { useSearch } from '@/hooks/useSearch'
import { useSpeech } from '@/hooks/useSpeech'
import { msg } from '@/i18n/messages'
import { mapService } from '@/services'
import type { GeoPosition, Place } from '@/types'
import { formatDistance } from '@/utils/format'
import { BigButton } from './BigButton'

interface Props {
  position: GeoPosition | null
  onSelect: (place: Place) => void
}

/** ช่องค้นหาจุดหมาย + รายการผลลัพธ์ที่กดเลือกได้ */
export function SearchPanel({ position, onSelect }: Props) {
  const inputId = useId()
  const { query, setQuery, results, isSearching, error, isEmpty, clear } = useSearch(position)
  const { speak } = useSpeech()
  const spokenForRef = useRef<string | null>(null)

  // ประกาศผลลัพธ์ด้วยเสียงหนึ่งครั้งต่อหนึ่งชุดผลลัพธ์
  useEffect(() => {
    if (isSearching) return
    const key = `${query}|${results.length}|${isEmpty}|${error?.code ?? ''}`
    if (spokenForRef.current === key) return
    if (query.trim().length < 2) return
    spokenForRef.current = key

    if (error) speak(msg.errors[`${error.code}_SPOKEN`], { priority: 'critical' })
    else if (isEmpty) speak(msg.search.noResultsSpoken)
    else if (results.length > 0) speak(msg.search.resultsSpoken(results.length))
  }, [error, isEmpty, isSearching, query, results.length, speak])

  return (
    <section
      aria-label={msg.search.label}
      className="border-t-2 border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <label htmlFor={inputId} className="block text-lg font-bold">
        {msg.search.label}
      </label>

      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={msg.search.placeholder}
          aria-describedby={`${inputId}-hint`}
          autoComplete="off"
          className="min-h-touch flex-1 rounded-xl border-2 border-slate-400 px-4 py-3 text-lg dark:border-slate-500 dark:bg-slate-800"
        />
        {query && (
          <BigButton variant="secondary" onClick={clear} aria-label={msg.search.clear}>
            ✕
          </BigButton>
        )}
      </div>

      <p id={`${inputId}-hint`} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {msg.search.hint}
      </p>

      {/* ประกาศสถานะการค้นหาให้ screen reader โดยไม่ต้องย้ายโฟกัส */}
      <p aria-live="polite" className="mt-2 text-base font-bold">
        {isSearching && msg.search.searching}
        {!isSearching && error && msg.errors[error.code]}
        {!isSearching && !error && isEmpty && msg.search.noResults}
      </p>

      {results.length > 0 && (
        <ul aria-label={msg.search.resultsLabel} className="mt-2 flex flex-col gap-2">
          {results.map((place) => {
            const distance = position ? mapService.distanceBetween(position, place.location) : null
            return (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => onSelect(place)}
                  className="min-h-touch w-full cursor-pointer rounded-xl border-2 border-slate-300 p-3 text-left hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
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
