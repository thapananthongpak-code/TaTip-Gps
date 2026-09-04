/**
 * ตาทิพย์ Navigator — โครงหน้าจอหลัก
 * Phase 0: ยังเป็นหน้าโครงเปล่า ใช้ยืนยันว่า build/Tailwind/โครงสร้าง service ทำงานได้
 * Phase 1 จะแทนที่ส่วนกลางด้วย <MapView /> จริง
 */
export default function App() {
  return (
    <div className="flex min-h-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="bg-brand-600 px-4 py-4 text-white">
        <h1 className="text-2xl font-bold">ตาทิพย์ Navigator</h1>
        <p className="text-base opacity-90">แอปนำทางด้วยเสียงสำหรับผู้พิการทางสายตา</p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-xl">โครงสร้างโปรเจกต์พร้อมแล้ว (Phase 0)</p>
        <p className="max-w-md text-base text-slate-600 dark:text-slate-300">
          ขั้นถัดไป: แผนที่ Leaflet + ติดตามตำแหน่ง GPS แบบเรียลไทม์
        </p>
      </main>
    </div>
  )
}
