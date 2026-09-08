/**
 * ค่าคงที่ของผู้ให้บริการภายนอก
 * ทุกบริการที่ใช้เป็นของฟรีและไม่ต้องใช้ API key
 * แต่มี rate limit — ดูรายละเอียดใน README ส่วน "ข้อจำกัดของบริการฟรี"
 */
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
export const OSM_MAX_ZOOM = 19

/** Nominatim: นโยบายกำหนดไม่เกิน 1 คำขอ/วินาที */
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
export const NOMINATIM_MIN_INTERVAL_MS = 1100

/**
 * OSRM สำหรับเส้นทางเดินเท้า
 *
 * ⚠️ router.project-osrm.org (demo server) ติดตั้งไว้เฉพาะ profile รถยนต์
 * เรียก /foot/ ไปก็ได้เส้นทางรถกลับมาเหมือนเดิมทุกประการ (ตรวจสอบแล้ว: ระยะและเวลาเท่ากันเป๊ะทุก profile)
 * ซึ่งอันตรายสำหรับแอปนำทางคนเดิน เพราะจะพาไปตามถนนรถ ไม่ใช้ทางเท้า และคิดเวลาด้วยความเร็วรถ
 *
 * จึงใช้อินสแตนซ์ของ FOSSGIS ที่ติดตั้ง profile เดินเท้าไว้จริง (ตัวเดียวกับที่เว็บ openstreetmap.org ใช้)
 * หากผู้ให้บริการเดินเท้าล่ม จะหยุดนำทาง ไม่เปลี่ยนไปใช้เส้นทางรถยนต์
 */
export const OSRM_BASE_URL = 'https://routing.openstreetmap.de/routed-foot'
export const OSRM_WALKING_PROFILE = 'foot'

/** Approximate ETA only; never used to reinterpret a driving route. */
export const WALKING_SPEED_MPS = 1.25

/** หน่วงการค้นหาอย่างน้อย 1 วินาที กัน rate limit ของ Nominatim */
export const SEARCH_DEBOUNCE_MS = 1000

/** ความแม่นยำ GPS ที่แย่กว่านี้ (เมตร) ถือว่าเชื่อถือไม่ได้ ต้องเตือนผู้ใช้ */
export const GPS_POOR_ACCURACY_M = 50

/** กรุงเทพฯ — จุดกึ่งกลางตั้งต้นก่อนได้ตำแหน่งจริง */
export const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 }
export const DEFAULT_ZOOM = 17
