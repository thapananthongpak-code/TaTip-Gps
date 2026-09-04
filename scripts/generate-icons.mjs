/**
 * สร้างไอคอน PWA ทุกขนาดจากโค้ด ไม่ต้องพึ่งไลบรารีประมวลผลภาพ
 *
 * เขียน PNG encoder เองเพราะเครื่องมือแปลง SVG (ImageMagick/rsvg/sharp)
 * ไม่ได้ติดตั้งอยู่บนทุกเครื่อง การมีสคริปต์ที่รันได้ด้วย Node เปล่าๆ
 * ทำให้ใครก็ตามสร้างไอคอนใหม่ได้เหมือนกันทุกครั้ง
 *
 * วิธีใช้: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const BRAND = [15, 82, 171] // #0f52ab
const WHITE = [255, 255, 255]

/** ตาราง CRC32 สำหรับ chunk ของ PNG */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** เข้ารหัสพิกเซล RGBA เป็นไฟล์ PNG */
function encodePng(width, height, rgba) {
  const stride = width * 4
  // แต่ละแถวขึ้นต้นด้วยไบต์ filter (0 = ไม่ใช้ filter)
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * วาดไอคอน: พื้นสีน้ำเงินแบรนด์ + หมุดตำแหน่งสีขาว
 *
 * วาดที่ความละเอียด 3 เท่าแล้วย่อลง เพื่อให้ขอบเรียบ (supersampling)
 * เพราะการวาดพิกเซลตรงๆ ไม่มี antialiasing ในตัว
 */
function drawIcon(size, { maskable }) {
  const SS = 3
  const w = size * SS
  const big = Buffer.alloc(w * w * 4)

  // maskable: ระบบปฏิบัติการอาจครอบเป็นวงกลม เนื้อหาสำคัญจึงต้องอยู่ใน 80% ตรงกลาง
  const scale = maskable ? 0.62 : 0.78
  const radius = maskable ? 0 : w * 0.22 // มุมโค้ง (maskable ให้เต็มกรอบ)

  const cx = w / 2
  const pinR = (w * scale) / 3.4
  const pinCy = w * (maskable ? 0.44 : 0.42)
  const tipY = pinCy + (w * scale) / 2.1
  const holeR = pinR * 0.42

  const inRoundedRect = (x, y) => {
    if (radius === 0) return true
    const dx = Math.max(radius - x, 0, x - (w - radius))
    const dy = Math.max(radius - y, 0, y - (w - radius))
    return dx * dx + dy * dy <= radius * radius
  }

  // หมุด = วงกลม + สามเหลี่ยมชี้ลง
  const inPin = (x, y) => {
    if ((x - cx) ** 2 + (y - pinCy) ** 2 <= pinR * pinR) return true
    if (y < pinCy || y > tipY) return false
    const halfWidth = pinR * (1 - (y - pinCy) / (tipY - pinCy))
    return Math.abs(x - cx) <= halfWidth
  }

  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (!inRoundedRect(x + 0.5, y + 0.5)) continue

      const inHole = (x - cx) ** 2 + (y - pinCy) ** 2 <= holeR * holeR
      const color = inPin(x + 0.5, y + 0.5) && !inHole ? WHITE : BRAND
      big[i] = color[0]
      big[i + 1] = color[1]
      big[i + 2] = color[2]
      big[i + 3] = 255
    }
  }

  // ย่อลงด้วยการเฉลี่ยบล็อกละ SS x SS
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * w + (x * SS + dx)) * 4
          r += big[i]
          g += big[i + 1]
          b += big[i + 2]
          a += big[i + 3]
        }
      }
      const n = SS * SS
      const o = (y * size + x) * 4
      out[o] = Math.round(r / n)
      out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n)
      out[o + 3] = Math.round(a / n)
    }
  }
  return encodePng(size, size, out)
}

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  { file: 'icon-64.png', size: 64, maskable: false },
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
]

for (const { file, size, maskable } of targets) {
  const png = drawIcon(size, { maskable })
  writeFileSync(join(OUT_DIR, file), png)
  console.log(`${file.padEnd(26)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`)
}
