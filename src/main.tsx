import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// ต้องตั้งค่า i18n ก่อน render ไม่งั้น component แรกจะยังไม่มีคำแปล
import './i18n'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
