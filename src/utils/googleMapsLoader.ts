import { GOOGLE_MAPS_BROWSER_KEY } from '@/services/config'

let pending: Promise<typeof google.maps> | null = null

/**
 * โหลดสคริปต์ Maps JavaScript API ครั้งเดียวต่อการเปิดแอปหนึ่งครั้ง
 *
 * โหลดตอนที่ต้องใช้จริง ไม่ใช่ใส่ใน index.html เพราะแอปต้องเปิดได้แม้ยังไม่ได้ตั้งค่าคีย์
 * และเพราะสคริปต์นี้หนัก การโหลดตอนเปิดแอปจะถ่วงเวลากว่าผู้ใช้จะได้ยินเสียงแรก
 *
 * เก็บ promise ไว้ใช้ซ้ำ เพราะ component อาจ mount หลายครั้งระหว่างสลับหน้า
 * ถ้าโหลดซ้ำ Google จะเตือนว่าโหลดหลายรอบและตัวแปร global จะถูกเขียนทับ
 */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (pending) return pending
  if (!GOOGLE_MAPS_BROWSER_KEY) return Promise.reject(new Error('missing key'))

  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_BROWSER_KEY,
      v: 'weekly',
      libraries: 'geometry',
      loading: 'async',
    })
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error('google.maps missing after load'))
    }
    script.onerror = () => {
      // ให้ลองใหม่ได้ในครั้งถัดไป ไม่ค้าง promise ที่พังไว้ตลอดอายุแอป
      pending = null
      reject(new Error('failed to load Google Maps'))
    }
    document.head.appendChild(script)
  })

  return pending
}
