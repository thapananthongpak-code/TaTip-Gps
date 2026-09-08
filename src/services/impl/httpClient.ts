import { ServiceError } from '@/types'

// Respect server-wide cooldowns for other calls too, not just this retry loop.
const cooldowns = new Map<string, number>()

export interface FetchJsonOptions {
  signal?: AbortSignal
  timeoutMs?: number
  retries?: number
  onRetry?: (attempt: number, delayMs: number, error: ServiceError) => void
  /** Schedule EVERY network attempt, including retries, through the provider queue. */
  schedule?: <T>(task: () => Promise<T>) => Promise<T>
}
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ServiceError('ABORTED'))
      return
    }
    const abort = () => {
      clearTimeout(timer)
      reject(new ServiceError('ABORTED'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { signal, timeoutMs = 12000, retries = 2, onRetry, schedule = (task) => task() } = options
  const provider = new URL(url, window.location.href).origin
  for (let attempt = 0; ; attempt++) {
    let retryAfter = 0
    try {
      return await schedule(async () => {
        if (signal?.aborted) throw new ServiceError('ABORTED')
        if ((cooldowns.get(provider) ?? 0) > Date.now())
          throw new ServiceError('RATE_LIMITED', 'Provider cooldown', { retryable: false })
        if (typeof navigator !== 'undefined' && !navigator.onLine) throw new ServiceError('NETWORK')
        const controller = new AbortController()
        const abort = () => controller.abort()
        signal?.addEventListener('abort', abort, { once: true })
        let timedOut = false
        const timer = setTimeout(() => {
          timedOut = true
          controller.abort()
        }, timeoutMs)
        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          })
          if (!response.ok) {
            const header = response.headers.get('Retry-After')
            if (header)
              retryAfter = Math.max(
                0,
                /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now(),
              )
            if (
              (response.status === 429 || response.status === 503) &&
              Number.isFinite(retryAfter)
            ) {
              cooldowns.set(
                provider,
                Date.now() + Math.max(retryAfter, response.status === 429 ? 1100 : 0),
              )
            }
            throw new ServiceError(
              response.status === 429
                ? 'RATE_LIMITED'
                : response.status === 404
                  ? 'NOT_FOUND'
                  : 'PROVIDER_ERROR',
              String(response.status),
              { retryable: response.status === 429 || response.status >= 500 },
            )
          }
          try {
            if ((cooldowns.get(provider) ?? 0) <= Date.now()) cooldowns.delete(provider)
            return (await response.json()) as T
          } catch (error) {
            throw new ServiceError('PROVIDER_ERROR', 'Invalid response', {
              cause: error,
              retryable: false,
            })
          }
        } catch (error) {
          if (signal?.aborted) throw new ServiceError('ABORTED')
          if (timedOut) throw new ServiceError('TIMEOUT')
          throw error
        } finally {
          clearTimeout(timer)
          signal?.removeEventListener('abort', abort)
        }
      })
    } catch (cause) {
      const error =
        cause instanceof ServiceError ? cause : new ServiceError('NETWORK', undefined, { cause })
      if (!error.retryable || attempt >= retries || retryAfter > 60000) throw error
      const delay = Math.max(retryAfter || 0, 1100 * 2 ** attempt + Math.random() * 300)
      onRetry?.(attempt + 1, delay, error)
      await abortableDelay(delay, signal)
    }
  }
}
