import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSpeechService } from '../src/services/impl/webSpeechService'

class Utterance {
  constructor(public text: string) {}
  lang = ''
  rate = 1
  voice = null
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
}
let spoken: Utterance[]
let service: WebSpeechService
beforeEach(() => {
  vi.useFakeTimers()
  spoken = []
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speak: vi.fn((u: Utterance) => spoken.push(u)),
      cancel: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [{ lang: 'th-TH' }, { lang: 'en-US' }],
    },
  })
  service = new WebSpeechService()
})
afterEach(() => {
  service.cancel()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('single-owner speech', () => {
  it('does not clear an audio failure just because the user pressed retry', () => {
    service.setMode('app')
    service.speak('First attempt')
    spoken[0].onerror?.()
    service.unlock()
    service.speak('Audible retry')
    expect(service.getSnapshot().failed).toBe(true)
    spoken[1].onstart?.()
    expect(service.getSnapshot().failed).toBe(true)
    spoken[1].onend?.()
    expect(service.getSnapshot().failed).toBe(false)
  })
  it('does not silently substitute an unrelated installed language', () => {
    window.speechSynthesis.getVoices = () => [{ lang: 'en-US' } as SpeechSynthesisVoice]
    service.setMode('app')
    service.setLanguage('th')
    service.speak('ทดสอบเสียง')
    expect(service.getSnapshot().failed).toBe(true)
    expect(spoken).toHaveLength(0)
  })
  it('reader mode emits announcements without synthesizing any speech', () => {
    service.speak('Turn left')
    expect(spoken).toHaveLength(0)
    expect(service.getSnapshot().text).toBe('Turn left')
  })
  it('a late cancelled callback cannot drain a new critical message', () => {
    service.setMode('app')
    service.speak('Old')
    const old = spoken[0]
    service.speak('GPS lost', { priority: 'critical' })
    service.speak('Next')
    old.onend?.()
    expect(spoken).toHaveLength(2)
    spoken[1].onend?.()
    expect(spoken[2].text).toBe('Next')
  })
  it('critical warnings do not repeatedly cancel one another', () => {
    service.setMode('app')
    service.speak('GPS lost', { priority: 'critical' })
    service.speak('Offline', { priority: 'critical' })
    expect(spoken).toHaveLength(1)
    spoken[0].onend?.()
    expect(spoken[1].text).toBe('Offline')
  })
  it('detects a silent engine which never fires start', () => {
    service.setMode('app')
    service.speak('Hello')
    vi.advanceTimersByTime(5001)
    expect(service.getSnapshot().failed).toBe(true)
    expect(service.getSnapshot().text).toBe('Hello')
    service.speak('Stop safely')
    expect(service.getSnapshot().failed).toBe(true)
    expect(spoken).toHaveLength(1)
  })
  it('reports an engine error instead of silently swallowing it', () => {
    service.setMode('app')
    service.speak('Hello')
    spoken[0].onerror?.()
    expect(service.getSnapshot().failed).toBe(true)
  })
  it('mode changes cancel the old voice and preserve language selection', () => {
    service.setMode('app')
    service.setLanguage('en')
    service.speak('Test')
    expect(spoken[0].lang).toBe('en-US')
    service.setMode('reader')
    service.speak('Reader only')
    expect(spoken).toHaveLength(1)
    expect(service.getSnapshot().text).toBe('Reader only')
  })
})
