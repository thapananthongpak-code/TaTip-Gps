import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dropServiceWorkerOnNative, isNativeApp } from '../src/utils/platform'

const unregister = vi.fn().mockResolvedValue(true)
const deleteCache = vi.fn().mockResolvedValue(true)

function asNative(native: boolean) {
  vi.stubGlobal('window', {
    ...globalThis.window,
    Capacitor: native ? { isNativePlatform: () => true } : undefined,
  })
  vi.stubGlobal('navigator', {
    serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
  })
  vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue(['old-assets']), delete: deleteCache })
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('isNativeApp', () => {
  it('รู้ว่ากำลังรันเป็นแอปที่ติดตั้งจาก APK', () => {
    asNative(true)
    expect(isNativeApp()).toBe(true)
  })

  it('เปิดผ่านเว็บไม่ถือเป็นแอปติดตั้ง', () => {
    asNative(false)
    expect(isNativeApp()).toBe(false)
  })
})

describe('dropServiceWorkerOnNative', () => {
  /*
   * ทดสอบบนอีมูเลเตอร์แล้วพบว่า หลังติดตั้ง APK ใหม่ทับของเดิม
   * service worker ยังเสิร์ฟไฟล์เก่าที่แคชไว้ แล้วขึ้นแถบ "มีเวอร์ชันใหม่" ให้กดอีกชั้น
   * ทั้งที่ไฟล์ใหม่อยู่ในเครื่องเรียบร้อยแล้ว
   */
  it('ถอน service worker และล้าง cache เมื่อเป็นแอปติดตั้ง', async () => {
    asNative(true)
    await dropServiceWorkerOnNative()
    expect(unregister).toHaveBeenCalled()
    expect(deleteCache).toHaveBeenCalledWith('old-assets')
  })

  /** เปิดผ่านเว็บยังต้องใช้ service worker ตามปกติ ห้ามไปถอนของเขา */
  it('ไม่แตะอะไรเลยเมื่อเปิดผ่านเว็บ', async () => {
    asNative(false)
    await dropServiceWorkerOnNative()
    expect(unregister).not.toHaveBeenCalled()
    expect(deleteCache).not.toHaveBeenCalled()
  })
})
