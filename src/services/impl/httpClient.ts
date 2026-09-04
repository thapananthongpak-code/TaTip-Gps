import { ServiceError } from '@/types'

export interface FetchJsonOptions {
  /** ยกเลิกจากฝั่งผู้เรียก (เช่น ผู้ใช้พิมพ์คำค้นใหม่) */
  signal?: AbortSignal
  /** หมดเวลาต่อหนึ่งครั้งที่ลอง */
  timeoutMs?: number
  /** จำนวนครั้งที่ลองซ้ำหลังครั้งแรกล้มเหลว */
  retries?: number
  /** แจ้งชั้นบนว่ากำลังจะลองใหม่ เพื่อเอาไปพูดบอกผู้ใช้ */
  onRetry?: (attempt: number, delayMs: number, error: ServiceError) => void
}

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_RETRIES = 2
const BACKOFF_BASE_MS = 800
const BACKOFF_MAX_MS = 8_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** exponential backoff + jitter — กันยิงซ้ำพร้อมกันจนโดนบล็อกหนักกว่าเดิม */
function backoffDelay(attempt: number): number {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS)
  return base + Math.random() * 300
}

function toServiceError(err: unknown, callerAborted: boolean): ServiceError {
  if (err instanceof ServiceError) return err
  if (callerAborted) return new ServiceError('ABORTED', 'คำขอถูกยกเลิก', { retryable: false })
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return new ServiceError('TIMEOUT', 'คำขอใช้เวลานานเกินไป', { cause: err })
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new ServiceError('ABORTED', 'คำขอถูกยกเลิก', { retryable: false, cause: err })
  }
  // fetch โยน TypeError เมื่อเน็ตหลุด / DNS ล้ม / CORS พัง
  return new ServiceError('NETWORK', 'เชื่อมต่อเครือข่ายไม่ได้', { cause: err })
}

function fromResponse(res: Response): ServiceError {
  if (res.status === 429) {
    return new ServiceError('RATE_LIMITED', 'ถูกจำกัดจำนวนคำขอ', { retryable: true })
  }
  if (res.status === 404) {
    return new ServiceError('NOT_FOUND', 'ไม่พบข้อมูล', { retryable: false })
  }
  if (res.status >= 500) {
    return new ServiceError('PROVIDER_ERROR', `เซิร์ฟเวอร์ตอบ ${res.status}`, { retryable: true })
  }
  return new ServiceError('PROVIDER_ERROR', `เซิร์ฟเวอร์ตอบ ${res.status}`, { retryable: false })
}

/**
 * เรียก API แบบมี timeout + retry แบบ exponential backoff
 *
 * ทำไมต้องมีชั้นนี้: ระหว่างนำทาง ถ้าเน็ตกระตุกแล้วปล่อยให้ error หลุดขึ้นไปทันที
 * ผู้ใช้ที่มองไม่เห็นจะเดินต่อโดยไม่รู้ว่าระบบหยุดทำงานไปแล้ว
 * ชั้นนี้จึงพยายามกู้เองก่อน และรายงานผ่าน onRetry ให้ชั้นบนพูดบอกได้ทันทีถ้าลองซ้ำแล้วยังไม่ผ่าน
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, onRetry } = options

  let lastError: ServiceError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      throw new ServiceError('ABORTED', 'คำขอถูกยกเลิก', { retryable: false })
    }
    // ไม่มีเน็ตแน่ๆ ก็ไม่ต้องเสียเวลารอ timeout
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      lastError = new ServiceError('NETWORK', 'อุปกรณ์ออฟไลน์')
      break
    }

    const timeout = AbortSignal.timeout(timeoutMs)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

    try {
      const res = await fetch(url, {
        signal: combined,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw fromResponse(res)
      return (await res.json()) as T
    } catch (err) {
      const error = toServiceError(err, signal?.aborted === true)
      lastError = error

      if (!error.retryable || attempt === retries) break

      const delay = backoffDelay(attempt)
      onRetry?.(attempt + 1, delay, error)
      await sleep(delay)
    }
  }

  throw lastError ?? new ServiceError('UNKNOWN')
}
