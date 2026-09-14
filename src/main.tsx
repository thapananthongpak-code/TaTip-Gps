import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// ต้องตั้งค่า i18n ก่อน render ไม่งั้น component แรกจะยังไม่มีคำแปล
import './i18n'
import App from './App.tsx'
import { dropServiceWorkerOnNative } from './utils/platform'

/*
 * แอปที่ติดตั้งจาก APK ไม่ต้องใช้ service worker เลย
 * ไฟล์อยู่ในเครื่องอยู่แล้ว การแคชซ้ำมีแต่ทำให้อัปเดตแอปแล้วยังเห็นของเก่า
 */
void dropServiceWorkerOnNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
