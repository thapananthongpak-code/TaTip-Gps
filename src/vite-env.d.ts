/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** คีย์ Maps JavaScript API — เปิดเผยได้ ต้องจำกัดสิทธิ์ใน Cloud Console */
  readonly VITE_GOOGLE_MAPS_BROWSER_KEY?: string
  /** URL ของ proxy ที่ถือคีย์ฝั่งเซิร์ฟเวอร์ ว่างได้ถ้าอยู่โดเมนเดียวกัน */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
