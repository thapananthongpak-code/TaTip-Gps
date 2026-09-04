import type { ShareContent, ShareOutcome, ShareService } from '@/services/interfaces'
import type { SharePayload } from '@/types'

/** เข้ารหัสแบบ base64url เพื่อให้ฝังใน URL ได้โดยไม่ต้อง escape เพิ่ม */
function encodePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodePayload(encoded: string): unknown {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

/** ตรวจรูปร่างข้อมูลจากลิงก์ก่อนเชื่อ เพราะเป็นข้อมูลที่คนอื่นแก้ได้ */
function validate(value: unknown): SharePayload | null {
  if (typeof value !== 'object' || value === null) return null
  const data = value as Record<string, unknown>
  const position = data.position as Record<string, unknown> | undefined

  if (
    typeof position?.lat !== 'number' ||
    typeof position?.lng !== 'number' ||
    typeof data.capturedAt !== 'number' ||
    typeof data.expiresAt !== 'number'
  ) {
    return null
  }

  const destination = data.destination as Record<string, unknown> | undefined
  const destLocation = destination?.location as Record<string, unknown> | undefined

  return {
    position: { lat: position.lat, lng: position.lng },
    accuracy: typeof data.accuracy === 'number' ? data.accuracy : 0,
    capturedAt: data.capturedAt,
    expiresAt: data.expiresAt,
    destination:
      typeof destination?.name === 'string' &&
      typeof destLocation?.lat === 'number' &&
      typeof destLocation?.lng === 'number'
        ? {
            name: destination.name,
            location: { lat: destLocation.lat, lng: destLocation.lng },
          }
        : undefined,
  }
}

export const webShareService: ShareService = {
  buildShareUrl(payload: SharePayload): string {
    // ใส่ข้อมูลไว้หลัง # เพราะเบราว์เซอร์ไม่ส่ง fragment ไปยังเซิร์ฟเวอร์
    // ตำแหน่งของผู้ใช้จึงไม่ถูกบันทึกใน access log ของโฮสต์ใดๆ
    return `${window.location.origin}${window.location.pathname}#/share/${encodePayload(payload)}`
  },

  parseShareUrl(url: string): SharePayload | null {
    const marker = '#/share/'
    const index = url.indexOf(marker)
    if (index === -1) return null

    try {
      const payload = validate(decodePayload(url.slice(index + marker.length)))
      if (!payload) return null
      // ลิงก์หมดอายุแล้วถือว่าใช้ไม่ได้ ไม่แสดงตำแหน่งย้อนหลังให้ใคร
      if (payload.expiresAt < Date.now()) return null
      return payload
    } catch {
      return null
    }
  },

  buildMapUrl(latitude: number, longitude: number): string {
    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`
  },

  openSms(phone: string, message: string): void {
    // iOS ใช้ &body= ส่วน Android ใช้ ?body= — ใช้ ?body= ซึ่งรองรับกว้างกว่า
    // ถ้าอุปกรณ์เปิดไม่ได้ ผู้ใช้ยังมีปุ่มคัดลอกข้อความเป็นทางสำรอง
    window.location.href = `sms:${phone.replace(/[^\d+]/g, '')}?body=${encodeURIComponent(message)}`
  },

  async share(content: ShareContent): Promise<ShareOutcome> {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share(content)
        return 'shared'
      } catch (err) {
        // ผู้ใช้กดยกเลิกแผงแชร์ ไม่ใช่ความผิดพลาด และไม่ควรไปคัดลอกทับคลิปบอร์ดเขา
        if (err instanceof DOMException && err.name === 'AbortError') return 'unavailable'
      }
    }

    try {
      await navigator.clipboard.writeText(`${content.text}\n${content.url}`)
      return 'copied'
    } catch {
      return 'unavailable'
    }
  },
}
