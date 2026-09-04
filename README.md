# ตาทิพย์ Navigator (Taa-Thip Navigator)

แอปนำทางด้วยเสียงสำหรับผู้พิการทางสายตา — Progressive Web App ต่อยอดจากโปรเจกต์ **ตาทิพย์** (เครื่องอ่านฉลากยาด้วย AI)

> **สถานะปัจจุบัน: Phase 0 เสร็จแล้ว** — โครงสร้างโปรเจกต์ + service layer + toolchain พร้อมใช้งาน

## Tech Stack

| ส่วน | เทคโนโลยี | ต้องใช้ API key |
| --- | --- | --- |
| Framework | React 19 + Vite + TypeScript | – |
| Styling | Tailwind CSS v4 | – |
| แผนที่ | Leaflet + react-leaflet + OpenStreetMap tiles | ไม่ต้อง |
| ค้นหาสถานที่ / reverse geocoding | Nominatim | ไม่ต้อง |
| คำนวณเส้นทางเดินเท้า | OSRM demo server (profile `foot`) | ไม่ต้อง |
| ตำแหน่ง | Geolocation API (`watchPosition`) | – |
| เสียง | Web Speech API (SpeechSynthesis / SpeechRecognition) | – |
| 2 ภาษา | react-i18next (th / en) | – |

## เริ่มต้นใช้งาน

```bash
npm install
npm run dev
```

เปิด http://localhost:5173

### คำสั่งอื่น

```bash
npm run build        # typecheck + build production
npm run preview      # ดู production build
npm run lint         # ESLint
npm run lint:fix     # ESLint แก้อัตโนมัติ
npm run format       # Prettier
npm run typecheck    # ตรวจ type อย่างเดียว
```

### ทดสอบบนมือถือจริง

Geolocation API และ Web Speech API **ต้องรันบน HTTPS หรือ localhost เท่านั้น** เปิดผ่าน `http://192.168.x.x:5173`
เบราว์เซอร์จะไม่ยอมให้ขอตำแหน่ง ทางเลือก:

- deploy ขึ้น Vercel แล้วเปิดจากมือถือ (ง่ายที่สุด)
- หรือใช้ tunnel เช่น `ngrok http 5173`

## โครงสร้างโปรเจกต์

```
src/
├── components/          # UI components
├── hooks/               # React hooks (useGeolocation, useSpeech, ...)
├── services/
│   ├── interfaces/      # ⭐ interface กลาง — ไม่ผูกกับผู้ให้บริการรายใดรายหนึ่ง
│   │   ├── mapService.ts
│   │   ├── geocodingService.ts
│   │   ├── routingService.ts
│   │   └── speechService.ts
│   ├── impl/            # implementation จริง (OSM / Nominatim / OSRM)
│   ├── config.ts        # URL + ค่าคงที่ของผู้ให้บริการ
│   └── index.ts         # composition root — จุดเดียวที่ผูก interface กับ impl
├── i18n/locales/        # th.json, en.json
├── types/               # โดเมนไทป์กลาง (LatLng, Route, RouteStep, ...)
├── context/
└── utils/
```

### หลักการ service layer (สำคัญ)

ทุก component และ hook **ต้อง import จาก `@/services` เท่านั้น ห้าม import จาก `services/impl/` โดยตรง**
ถ้าวันหนึ่งอยากย้ายจาก OpenStreetMap ไป Google Maps:

1. เขียน implementation ใหม่ใน `services/impl/` ที่ implement interface เดิม
2. แก้บรรทัดผูก implementation ใน `services/index.ts` บรรทัดเดียว
3. ไม่ต้องแตะ component / hook ใดๆ

โดเมนไทป์กลาง (`LatLng`, `Route`, `RouteStep`, `ManeuverType`) ถูกออกแบบให้เป็นกลาง ไม่ใช่ shape ของ OSRM หรือ Leaflet
ดังนั้น implementation มีหน้าที่แปลงข้อมูลของผู้ให้บริการมาเป็นไทป์กลางเสมอ

## ⚠️ ข้อจำกัดของบริการฟรี (อ่านก่อนใช้งานจริง)

โปรเจกต์นี้ใช้บริการสาธารณะฟรีทั้งหมด **เหมาะกับงานเรียน / ต้นแบบ / เดโม เท่านั้น** ไม่เหมาะกับโปรดักชันจริงที่มีผู้ใช้จำนวนมาก

### Nominatim (ค้นหาสถานที่)

- นโยบายกำหนด **ไม่เกิน 1 คำขอต่อวินาที** ยิงถี่กว่านี้อาจโดนบล็อก IP
- ห้ามใช้ทำ bulk geocoding
- โปรเจกต์นี้ป้องกันด้วย: debounce การค้นหา 1 วินาที (`SEARCH_DEBOUNCE_MS`), ตัวคุมคิวคำขอขั้นต่ำ 1.1 วินาที (`NOMINATIM_MIN_INTERVAL_MS`), และ cache ผลลัพธ์ที่ค้นซ้ำ (Phase 4)

### OSRM demo server (คำนวณเส้นทาง)

- เป็นเซิร์ฟเวอร์เดโม **ไม่มี SLA ไม่รับประกัน uptime** และอาจ throttle หรือปิดเมื่อไหร่ก็ได้
- ห้ามใช้งานหนัก
- โปรเจกต์นี้ป้องกันด้วย: จำกัดความถี่การคำนวณเส้นทางใหม่ + retry แบบ exponential backoff + แจ้งเตือนผู้ใช้ด้วยเสียงเมื่อบริการล่ม (Phase 2)

### OpenStreetMap tile server

- มี [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) ห้าม bulk download tile และต้องแสดง attribution เสมอ

### ถ้าจะขยายเป็นโปรดักชันจริง

| ต้องการ | ทางเลือก |
| --- | --- |
| Geocoding | self-host Nominatim, หรือใช้ Photon / LocationIQ / Mapbox / Google Places (มีค่าใช้จ่าย) |
| Routing | self-host OSRM หรือ Valhalla, หรือ GraphHopper / Mapbox Directions |
| Tiles | MapTiler / Stadia Maps / Mapbox หรือ self-host tile server |

โครงสร้าง service layer ของโปรเจกต์นี้ออกแบบมาเพื่อรองรับการย้ายเหล่านี้อยู่แล้ว

## ความเป็นส่วนตัว (PDPA)

จะเขียนละเอียดใน Phase 4–5 หลักการคือ: ข้อมูลตำแหน่งและผู้ติดต่อฉุกเฉินอยู่บนเครื่องผู้ใช้เท่านั้น ไม่ส่งขึ้น server ใดๆ

## Deploy

จะเพิ่มขั้นตอน Vercel ใน Phase 5

## แผนการพัฒนา

- [x] **Phase 0** — Setup & โครงสร้างพื้นฐาน
- [ ] **Phase 1** — แผนที่ + GPS tracking
- [ ] **Phase 2** — ค้นหาจุดหมาย + เส้นทาง + นำทางเสียง
- [ ] **Phase 3** — ระบบ 2 ภาษา (i18n)
- [ ] **Phase 4** — ฟีเจอร์ความปลอดภัย (SOS, live share, จุดเสี่ยง, สั่นเตือน)
- [ ] **Phase 5** — PWA + Accessibility + Deploy
