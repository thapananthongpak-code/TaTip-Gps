/** โค้ดข้อผิดพลาดกลางของ service ทุกตัว — UI/เสียงแปลผ่าน i18n key `errors.<code>` */
export type ServiceErrorCode =
  | 'NETWORK'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'PROVIDER_ERROR'
  /** ยังไม่มีตำแหน่ง GPS เลย จึงเริ่มคำนวณเส้นทางไม่ได้ */
  | 'NO_POSITION'
  /**
   * รู้ตำแหน่งแล้ว แต่ยังไม่แม่นพอจะนำทาง
   *
   * ต้องแยกจาก NO_POSITION ให้ขาด เพราะทางแก้ต่างกันคนละเรื่อง
   * ไม่มีตำแหน่งเลย = รอให้ระบบหาเจอก่อน
   * ไม่แม่นพอ = ต้องย้ายตัวเองออกไปที่โล่ง ซึ่งรอเฉยๆ ไม่มีวันหาย
   */
  | 'POSITION_TOO_COARSE'
  | 'UNKNOWN'

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
