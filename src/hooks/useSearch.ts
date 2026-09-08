import { useCallback, useEffect, useRef, useState } from 'react'
import { currentLanguage } from '@/i18n'
import { geocodingService, SEARCH_DEBOUNCE_MS } from '@/services'
import { ServiceError } from '@/types'
import type { LatLng, Place } from '@/types'

/** Public Nominatim forbids autocomplete. Search only on explicit form submission. */
export function useSearch(near: LatLng | null) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<ServiceError | null>(null)
  const [isEmpty, setIsEmpty] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const updateQuery = useCallback((value: string) => {
    controller.current?.abort()
    clearTimeout(timer.current)
    setQuery(value)
    setResults([])
    setError(null)
    setIsEmpty(false)
    setIsSearching(false)
  }, [])
  const search = useCallback(() => {
    if (query.trim().length < 2) return
    controller.current?.abort()
    clearTimeout(timer.current)
    const request = new AbortController()
    controller.current = request
    setIsSearching(true)
    setResults([])
    setError(null)
    setIsEmpty(false)
    timer.current = setTimeout(async () => {
      try {
        const found = await geocodingService.search(query, {
          near: near ?? undefined,
          language: currentLanguage(),
          signal: request.signal,
        })
        if (request.signal.aborted) return
        setResults(found)
        setIsEmpty(found.length === 0)
      } catch (err) {
        if (!request.signal.aborted)
          setError(err instanceof ServiceError ? err : new ServiceError('UNKNOWN'))
      } finally {
        if (!request.signal.aborted) setIsSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)
  }, [query, near])
  useEffect(
    () => () => {
      controller.current?.abort()
      clearTimeout(timer.current)
    },
    [],
  )
  return {
    query,
    setQuery: updateQuery,
    results,
    isSearching,
    error,
    isEmpty,
    search,
    clear: () => updateQuery(''),
  }
}
