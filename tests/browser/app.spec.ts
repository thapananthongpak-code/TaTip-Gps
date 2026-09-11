import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

type OverpassMock = { places: unknown[]; obstacles: unknown[] } | 'fail'

async function setup(page: Page, options: { denial?: boolean; overpass?: OverpassMock } = {}) {
  await page.addInitScript(({ denial }) => {
    if (!localStorage.getItem('taathip.language')) localStorage.setItem('taathip.language', 'en')
    type TestWindow = Window & {
      __fix: (lat: number, lng: number, accuracy?: number) => void
      __said: string[]
    }
    const target = window as unknown as TestWindow
    target.__said = []
    let success: PositionCallback | null = null
    target.__fix = (lat, lng, accuracy = 5) =>
      success?.({
        coords: {
          latitude: lat,
          longitude: lng,
          accuracy,
          heading: null,
          speed: null,
          altitude: null,
          altitudeAccuracy: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition)
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition(ok: PositionCallback, fail: PositionErrorCallback) {
          success = ok
          setTimeout(
            () =>
              denial
                ? fail({ code: 1, message: 'denied' } as GeolocationPositionError)
                : target.__fix(0, 0),
            50,
          )
          return 1
        },
        clearWatch() {
          success = null
        },
      },
    })
    class FakeSpeech {
      text: string
      lang = ''
      onstart?: () => void
      onend?: () => void
      constructor(text: string) {
        this.text = text
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeSpeech })
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak(u: FakeSpeech) {
          // บันทึกไว้เพื่อพิสูจน์ว่าแอปไม่เคยเรียก ไม่ใช่เพื่อจำลองการพูด
          target.__said.push(u.text)
        },
        cancel() {},
        resume() {},
        getVoices: () => [{ lang: 'th-TH' }, { lang: 'en-US' }],
      },
    })
  }, options)
  // Keep tests deterministic and do not send location/search data to public providers.
  await page.route('https://**/*', async (route) => {
    const url = route.request().url()
    if (url.includes('/search?'))
      return route.fulfill({
        json: [
          {
            place_id: 1,
            lat: '.001',
            lon: '.001',
            display_name: 'Test destination, Test road',
            name: 'Test destination',
          },
        ],
      })
    if (url.includes('/reverse?'))
      return route.fulfill({
        json: {
          place_id: 2,
          lat: '0',
          lon: '0',
          name: 'Test place',
          display_name: 'Test place, Test road',
        },
      })
    if (url.includes('/api/interpreter')) {
      if (!options.overpass || options.overpass === 'fail') return route.abort()
      // Overpass จริงกรองตามคำถามให้ฝั่งเซิร์ฟเวอร์ mock จึงต้องแยกตามคำถามด้วย
      // ไม่งั้นผลของการค้นรอบตัวกับการตรวจสิ่งกีดขวางจะปนกัน
      const asksForSteps = decodeURIComponent(url).includes('highway=steps')
      return route.fulfill({
        json: { elements: asksForSteps ? options.overpass.obstacles : options.overpass.places },
      })
    }
    if (url.includes('/route/v1/'))
      return route.fulfill({
        json: {
          code: 'Ok',
          routes: [
            {
              distance: 222,
              duration: 180,
              geometry: {
                coordinates: [
                  [0, 0],
                  [0.001, 0],
                  [0.001, 0.001],
                ],
              },
              legs: [
                {
                  steps: [
                    {
                      distance: 111,
                      duration: 90,
                      name: 'Test road',
                      maneuver: { type: 'depart', location: [0, 0] },
                      geometry: {
                        coordinates: [
                          [0, 0],
                          [0.001, 0],
                        ],
                      },
                    },
                    {
                      distance: 111,
                      duration: 90,
                      name: 'Test lane',
                      maneuver: { type: 'turn', modifier: 'left', location: [0.001, 0] },
                      geometry: {
                        coordinates: [
                          [0.001, 0],
                          [0.001, 0.001],
                        ],
                      },
                    },
                    {
                      distance: 0,
                      duration: 0,
                      name: '',
                      maneuver: { type: 'arrive', location: [0.001, 0.001] },
                      geometry: { coordinates: [[0.001, 0.001]] },
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
    return route.abort()
  })
  await page.goto('/')
}
async function fix(page: Page, lat: number, lng: number, accuracy = 5) {
  await page.evaluate(
    ({ lat, lng, accuracy }) => {
      ;(window as unknown as { __fix: (lat: number, lng: number, accuracy: number) => void }).__fix(
        lat,
        lng,
        accuracy,
      )
    },
    { lat, lng, accuracy },
  )
}
async function startRoute(page: Page) {
  await page.getByRole('button', { name: 'Start and allow location access', exact: true }).click()
  await expect(page.getByText('Good signal', { exact: false })).toBeVisible()
  await page.getByRole('searchbox').fill('Test destination')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: /Test destination/ }).click()
  await expect(page.locator('#navigation-panel')).toContainText('turn left')
}

test('announcements go through one polite live region and the app never synthesizes speech', async ({
  page,
}) => {
  await setup(page)
  await startRoute(page)
  // แอปประกาศผ่านโปรแกรมอ่านหน้าจออย่างเดียว ห้ามเรียก SpeechSynthesis เองแม้ครั้งเดียว
  expect(await page.evaluate(() => (window as unknown as { __said: string[] }).__said)).toEqual([])
  await fix(page, 0, 0.00087)
  await expect(page.locator('#navigation-panel')).toContainText('turn left')
  await expect(page.locator('[aria-live="assertive"]')).toHaveCount(0)
  await expect(page.locator('[aria-live="polite"]')).toHaveCount(1)
})
test('navigation pauses for poor GPS and suppresses walking instructions', async ({ page }) => {
  await setup(page)
  await startRoute(page)
  await fix(page, 0, 0.0009, 80)
  await expect(page.locator('#navigation-panel')).toContainText('Walking guidance paused')
  await expect(page.locator('#navigation-panel')).not.toContainText('Follow the route')
  await fix(page, 0, 0.0009, 5)
  await expect(page.locator('#navigation-panel')).toContainText('turn left')
})
test('SOS remains usable with denied GPS; dialog supports keyboard and sends nothing on open', async ({
  page,
}) => {
  await setup(page, { denial: true })
  await page.getByRole('button', { name: 'Start and allow location access', exact: true }).click()
  await expect(
    page.getByText('Location access was denied, so the app cannot guide you'),
  ).toBeVisible()
  const sos = page.getByRole('button', { name: /^Request help/ })
  await sos.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Help request message')).toHaveValue(/cannot find my location/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(sos).toBeFocused()
})
test('no autocomplete requests before explicit submission; clears stale results on edit', async ({
  page,
}) => {
  await setup(page)
  let searches = 0
  page.on('request', (request) => {
    if (request.url().includes('/search?')) searches++
  })
  await page.getByRole('button', { name: 'Start and allow location access', exact: true }).click()
  await page.getByRole('searchbox').fill('Test')
  await page.waitForTimeout(1200)
  expect(searches).toBe(0)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('button', { name: /Test destination/ })).toBeVisible()
  await page.getByRole('searchbox').fill('Different')
  await expect(page.getByRole('button', { name: /Test destination/ })).toHaveCount(0)
})
test('keyboard settings, language persistence, mobile reflow and automated accessibility', async ({
  page,
}) => {
  await setup(page)
  await page.getByText('Settings', { exact: true }).click()
  await page.getByRole('radio', { name: 'Extra large' }).check()
  await page.getByRole('radio', { name: 'Dark', exact: true }).check()
  await page.setViewportSize({ width: 320, height: 640 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(result.violations).toEqual([])
  await page.screenshot({ path: 'test-results/mobile-dark.png', fullPage: true })
  await page.getByRole('button', { name: 'Switch to Thai' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
  expect(await page.evaluate(() => localStorage.getItem('taathip.language'))).toBe('th')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
})
test('app shell reopens offline after service worker installation', async ({ page, context }) => {
  await setup(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Taa-Thip Navigator' })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Taa-Thip Navigator' })).toBeVisible()
  await expect(page.getByText(/Offline: search and new routes/)).toBeVisible()
})

test('off-route state suppresses the old instruction including Repeat', async ({ page }) => {
  await setup(page)
  await startRoute(page)
  await fix(page, 0.01, 0.01)
  await page.waitForTimeout(50)
  await fix(page, 0.0101, 0.01)
  await expect(page.locator('#navigation-panel')).not.toContainText('turn left')
  await page.getByRole('button', { name: 'Repeat instruction' }).click()
  await expect(page.getByTestId('announcer')).toContainText('off the route')
})

test('missing GPS updates pause navigation without any browser error callback', async ({
  page,
}) => {
  await setup(page)
  await page.clock.install()
  await startRoute(page)
  await page.clock.fastForward(16000)
  await expect(page.locator('#navigation-panel')).toContainText('Walking guidance paused')
})

test('native radio groups work with arrow keys and the skip link focuses main', async ({
  page,
}) => {
  await setup(page)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
  await page.getByText('Settings', { exact: true }).click()
  await page.getByRole('radio', { name: 'Normal', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Large', exact: true })).toBeChecked()
})

test('routing outage retries with backoff then announces failure without a driving fallback', async ({
  page,
}) => {
  await setup(page)
  const requests: string[] = []
  await page.route('**/route/v1/**', async (request) => {
    requests.push(request.request().url())
    await request.fulfill({ status: 503, headers: { 'Retry-After': '1' }, body: '{}' })
  })
  await page.getByRole('button', { name: 'Start and allow location access', exact: true }).click()
  await page.getByRole('searchbox').fill('Test destination')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: /Test destination/ }).click()
  await expect(page.locator('#navigation-panel')).toContainText('The map service is unavailable', {
    timeout: 12000,
  })
  await expect(page.getByTestId('announcer')).toContainText('stop somewhere safe', {
    timeout: 12000,
  })
  expect(requests).toHaveLength(3)
  expect(requests.every((url) => url.includes('/routed-foot/'))).toBe(true)
  await expect(page.locator('#navigation-panel')).not.toContainText('turn left')
})

test('stopping guidance restores focus to search and announces the stopped state', async ({
  page,
}) => {
  await setup(page)
  await startRoute(page)
  await page.getByRole('button', { name: 'Stop navigation' }).click()
  await expect(page.getByRole('searchbox')).toBeFocused()
  await expect(page.getByTestId('announcer')).toContainText('Navigation stopped')
})

test('guidance, paused state and SOS dialog pass automated accessibility in light and dark themes', async ({
  page,
}) => {
  await setup(page)
  await startRoute(page)
  for (const theme of ['Light', 'Dark']) {
    await fix(page, 0, 0.0001)
    await page.getByText('Settings', { exact: true }).click()
    await page.getByRole('radio', { name: theme, exact: true }).check()
    await page.getByText('Settings', { exact: true }).click()
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([])
    await fix(page, 0, 0.0001, 80)
    await expect(page.locator('#navigation-panel')).toContainText('Walking guidance paused')
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([])
    await page.getByRole('button', { name: /^Request help/ }).click()
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([])
    await page.keyboard.press('Escape')
  }
})

/** สิ่งที่ Overpass ตอบกลับมา แยกตามคำถามเหมือนของจริง */
const overpass = {
  places: [
    {
      type: 'node',
      id: 101,
      lat: 0.0005,
      lon: 0.0005,
      tags: { highway: 'bus_stop', name: 'Test bus stop' },
    },
    // ไม่มีชื่อ — ต้องแสดงชื่อหมวดแทน ไม่ใช่ปุ่มเปล่าที่ screen reader อ่านไม่ได้
    { type: 'node', id: 102, lat: 0.0006, lon: 0.0004, tags: { highway: 'bus_stop' } },
  ],
  obstacles: [
    {
      type: 'way',
      id: 201,
      center: { lat: 0, lon: 0.0005 },
      tags: { highway: 'steps', step_count: '12', handrail: 'yes', incline: 'up' },
    },
  ],
}

test('nearby category search lists places, names unnamed ones and sets a destination', async ({
  page,
}) => {
  await setup(page, { overpass })
  await page.getByRole('button', { name: 'Start and allow location access', exact: true }).click()
  await expect(page.getByText('Good signal', { exact: false })).toBeVisible()

  await page.getByRole('button', { name: 'Bus & train', exact: true }).click()

  // เจาะจงรายการผลลัพธ์ เพราะหมุดบนแผนที่ก็มีชื่อเดียวกัน (ตั้งใจให้เป็นแบบนั้น)
  const results = page.getByRole('list', { name: 'Search results' })
  const namedResult = results.getByRole('button', { name: /Test bus stop/ })
  await expect(namedResult).toBeVisible()
  // สถานที่ที่ไม่มีชื่อในแผนที่ต้องยังอ่านออกเสียงได้ ไม่ใช่ปุ่มเปล่า
  await expect(results.getByRole('button', { name: /Public transport stop/ })).toBeVisible()

  // หมุดบนแผนที่ต้องมีเลขกำกับตรงกับลำดับในรายการ เพื่ออ้างอิงถึงรายการเดียวกันได้
  await expect(page.getByRole('button', { name: 'Search result 1: Test bus stop' })).toBeAttached()

  await namedResult.click()
  await expect(page.locator('#navigation-panel')).toContainText('turn left')
})

test('obstacle report separates a failed scan from a genuinely clear route', async ({ page }) => {
  // กรณีตรวจไม่สำเร็จ ต้องไม่บอกว่าเส้นทางปลอดภัย
  await setup(page, { overpass: 'fail' })
  await startRoute(page)
  await expect(
    page
      .getByRole('region', { name: 'Obstacles on the route' })
      .getByText('Could not check for obstacles', { exact: true }),
  ).toBeVisible()
  // ต้องประกาศออกไปด้วย ไม่ใช่แค่ขึ้นบนจอ เพราะผู้ใช้ที่มองไม่เห็นจะไม่รู้เลย
  await expect(page.getByTestId('announcer')).toContainText('does not mean the route is clear')
})

test('obstacle report lists steps found on the route with detail that matters before stepping', async ({
  page,
}) => {
  await setup(page, { overpass })
  await startRoute(page)

  const report = page.getByRole('region', { name: 'Obstacles on the route' })
  await expect(report).toContainText('1 set of steps')
  // จำนวนขั้น ทิศขึ้นลง และราวจับ คือสามสิ่งที่ต้องรู้ก่อนเท้าแตะขั้นแรก
  await expect(report).toContainText('12 steps')
  await expect(report).toContainText('going up')
  await expect(report).toContainText('with a handrail')
})
