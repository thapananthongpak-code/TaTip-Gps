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

/**
 * Overpass API — ใช้ค้นหาสถานที่รอบตัวตามหมวดหมู่ และตรวจสิ่งกีดขวางบนเส้นทาง
 *
 * ฟรี ไม่ต้องใช้ key แต่เป็นทรัพยากรที่บริจาคกันมา จึงต้องใช้อย่างสุภาพ:
 * ต่อคิวคำขอ ไม่ยิงถี่ และ cache ผลลัพธ์ไว้ใช้ซ้ำ
 * คำขอหนึ่งครั้งใช้เวลา 1-5 วินาที ช้ากว่า Nominatim มาก จึงต้องบอกผู้ใช้ว่ากำลังค้นหาอยู่
 */
/**
 * เรียงตามลำดับที่จะลอง — ตัวแรกที่ตอบสำเร็จจะถูกใช้ต่อไปจนกว่าจะล่ม
 *
 * ต้องมีหลายตัวเพราะทดสอบแล้วพบว่าเซิร์ฟเวอร์เหล่านี้ล่มหรือบล็อก IP บ่อยมาก
 * (ยิงทดสอบถี่ไปไม่กี่สิบครั้งก็โดนบล็อกชั่วคราวแล้ว)
 *
 * เลือกเฉพาะ mirror ของชุมชน OSM ที่ตรวจสอบที่มาได้ เพราะคำขอแต่ละครั้ง
 * มีพิกัดของผู้ใช้ติดไปด้วย จึงไม่ควรส่งให้ผู้ให้บริการที่ไม่รู้ว่าเก็บข้อมูลอย่างไร
 */
export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
]
export const OVERPASS_MIN_INTERVAL_MS = 1500
export const OVERPASS_TIMEOUT_MS = 30000

/** รัศมีค้นหาสถานที่ใกล้ตัวโดยปริยาย (เมตร) — ระยะที่คนเดินไหวใน 10 นาที */
export const NEARBY_RADIUS_M = 800

/** ระยะจากเส้นทางที่ถือว่าสิ่งกีดขวางเกี่ยวข้องกับเรา (เมตร) */
export const OBSTACLE_CORRIDOR_M = 25

/** เตือนสิ่งกีดขวางล่วงหน้าเมื่อเข้าใกล้กว่านี้ (เมตร) */
export const OBSTACLE_WARNING_DISTANCE_M = 30

/** หน่วงการค้นหาอย่างน้อย 1 วินาที กัน rate limit ของ Nominatim */
export const SEARCH_DEBOUNCE_MS = 1000

/** ความแม่นยำ GPS ที่แย่กว่านี้ (เมตร) ถือว่าเชื่อถือไม่ได้ ต้องเตือนผู้ใช้ */
export const GPS_POOR_ACCURACY_M = 50

/** กรุงเทพฯ — จุดกึ่งกลางตั้งต้นก่อนได้ตำแหน่งจริง */
export const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 }
export const DEFAULT_ZOOM = 17
