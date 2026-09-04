/**
 * ค่าคงที่ของผู้ให้บริการภายนอก
 * ทุกบริการที่ใช้เป็นของฟรีและไม่ต้องใช้ API key
 * แต่มี rate limit — ดูรายละเอียดใน README ส่วน "ข้อจำกัดของบริการฟรี"
 */
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
export const OSM_MAX_ZOOM = 19

/** Nominatim: นโยบายกำหนดไม่เกิน 1 คำขอ/วินาที */
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
export const NOMINATIM_MIN_INTERVAL_MS = 1100

/** OSRM demo server: ห้ามใช้งานหนัก ไม่มี SLA */
export const OSRM_BASE_URL = 'https://router.project-osrm.org'
export const OSRM_WALKING_PROFILE = 'foot'

/** หน่วงการค้นหาอย่างน้อย 1 วินาที กัน rate limit ของ Nominatim */
export const SEARCH_DEBOUNCE_MS = 1000

/** ความแม่นยำ GPS ที่แย่กว่านี้ (เมตร) ถือว่าเชื่อถือไม่ได้ ต้องเตือนผู้ใช้ */
export const GPS_POOR_ACCURACY_M = 50

/** กรุงเทพฯ — จุดกึ่งกลางตั้งต้นก่อนได้ตำแหน่งจริง */
export const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 }
export const DEFAULT_ZOOM = 17
