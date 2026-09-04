/** โค้ดข้อผิดพลาดกลางของ service ทุกตัว — UI/เสียงแปลผ่าน i18n key `errors.<code>` */
export type ServiceErrorCode =
  'NETWORK' | 'RATE_LIMITED' | 'NOT_FOUND' | 'TIMEOUT' | 'ABORTED' | 'PROVIDER_ERROR' | 'UNKNOWN'

export class ServiceError extends Error {
  readonly code: ServiceErrorCode
  /** true ถ้าลองใหม่แล้วมีโอกาสสำเร็จ (ใช้กับ retry/backoff ใน Phase 2) */
  readonly retryable: boolean

  constructor(
    code: ServiceErrorCode,
    message?: string,
    options?: { retryable?: boolean; cause?: unknown },
  ) {
    super(message ?? code, { cause: options?.cause })
    this.name = 'ServiceError'
    this.code = code
    this.retryable =
      options?.retryable ?? (code === 'NETWORK' || code === 'TIMEOUT' || code === 'RATE_LIMITED')
  }
}

/** ภาษาที่ส่งไปให้ผู้ให้บริการ (เช่น Nominatim accept-language) */
export type ServiceLanguage = 'th' | 'en'
