import type {
  SpeakOptions,
  SpeechMode,
  SpeechService,
  SpeechSnapshot,
} from '@/services/interfaces/speechService'
import type { ServiceLanguage } from '@/types'

interface QueueItem {
  text: string
  options: SpeakOptions
  expires: number
}

/** One output channel. Browser speech cannot observe or arbitrate a screen reader. */
export class WebSpeechService implements SpeechService {
  private queue: QueueItem[] = []
  private current: SpeechSynthesisUtterance | null = null
  private currentItem: QueueItem | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private language: ServiceLanguage = 'th'
  private retryArmed = false
  private listeners = new Set<() => void>()
  private snapshot: SpeechSnapshot = {
    mode: 'reader',
    text: '',
    sequence: 0,
    failed: false,
    speaking: false,
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.snapshot
  private publish(update: Partial<SpeechSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update }
    this.listeners.forEach((listener) => listener())
  }
  isSupported() {
    return typeof window !== 'undefined' && typeof window.speechSynthesis?.speak === 'function'
  }
  hasVoiceFor(language: ServiceLanguage) {
    return (
      this.isSupported() &&
      window.speechSynthesis
        .getVoices()
        .some((v) => v.lang.replace('_', '-').toLowerCase().startsWith(language))
    )
  }
  setLanguage(language: ServiceLanguage) {
    this.language = language
  }
  setMode(mode: SpeechMode) {
    this.cancel()
    this.publish({ mode, failed: false })
  }
  // Called by a real button. The audible test is the unlock gesture, not a silent utterance.
  unlock() {
    if (this.snapshot.mode === 'app' && this.isSupported()) {
      // Keep guidance suspended until an actual retry utterance finishes.
      this.retryArmed = this.snapshot.failed
      window.speechSynthesis.resume()
    }
  }
  cancel() {
    this.retryArmed = false
    clearTimeout(this.timer)
    this.current = null // Invalidate handlers BEFORE cancel emits asynchronous events.
    this.currentItem = null
    this.queue = []
    if (this.isSupported()) window.speechSynthesis.cancel()
    this.publish({ speaking: false, text: '' })
  }
  speak(text: string, options: SpeakOptions = {}) {
    if (!text.trim()) return
    const item = {
      text,
      options: { language: this.language, ...options },
      expires: Date.now() + 20_000,
    }
    if (options.group) this.queue = this.queue.filter((q) => q.options.group !== options.group)
    if (this.currentItem?.text === text || this.queue.some((q) => q.text === text)) return
    if (options.priority === 'critical') {
      this.queue = this.queue.filter((q) => q.options.priority === 'critical')
      if (this.currentItem && this.currentItem.options.priority !== 'critical') {
        clearTimeout(this.timer)
        this.current = null
        this.currentItem = null
        if (this.isSupported()) window.speechSynthesis.cancel()
      }
    }
    this.queue.push(item)
    this.queue = this.queue.slice(-8)
    if (!this.currentItem) this.drain()
  }
  private drain() {
    clearTimeout(this.timer)
    const item = this.queue.shift()
    if (!item) {
      this.currentItem = null
      this.publish({ speaking: false })
      return
    }
    if (item.expires < Date.now()) {
      this.drain()
      return
    }
    this.currentItem = item
    const recovering = this.retryArmed && this.snapshot.failed
    this.retryArmed = false
    const reader =
      this.snapshot.mode === 'reader' ||
      (this.snapshot.failed && !recovering) ||
      !this.isSupported()
    this.publish({
      text: item.text,
      sequence: this.snapshot.sequence + 1,
      speaking: true,
      failed: this.snapshot.failed || (!this.isSupported() && this.snapshot.mode === 'app'),
    })
    if (reader) {
      // ARIA offers no completion event: pace announcements, never claim delivery was heard.
      this.timer = setTimeout(
        () => {
          this.currentItem = null
          this.drain()
        },
        Math.min(12000, Math.max(2500, item.text.length * 65)),
      )
      return
    }
    const utterance = new SpeechSynthesisUtterance(item.text)
    this.current = utterance
    utterance.lang = item.options.language === 'en' ? 'en-US' : 'th-TH'
    utterance.rate = Math.min(1.4, Math.max(0.6, item.options.rate ?? 1))
    const voices = window.speechSynthesis.getVoices()
    const voice =
      voices.find((v) => v.lang.replace('_', '-') === utterance.lang) ??
      voices.find((v) => v.lang.replace('_', '-').startsWith(utterance.lang.slice(0, 2)))
    if (voice) utterance.voice = voice
    const fail = () => {
      if (this.current !== utterance) return
      this.cancel()
      this.publish({ failed: true, text: item.text, sequence: this.snapshot.sequence + 1 })
    }
    // A known voice list with no matching language must not silently use an
    // unrelated language. Empty lists may still be loading in some browsers.
    if (voices.length > 0 && !voice) {
      fail()
      return
    }
    utterance.onstart = () => {
      if (this.current !== utterance) return
      clearTimeout(this.timer)
      this.timer = setTimeout(fail, Math.max(30_000, item.text.length * 180))
    }
    utterance.onend = () => {
      if (this.current !== utterance) return
      this.current = null
      this.currentItem = null
      if (recovering) this.publish({ failed: false })
      this.drain()
    }
    utterance.onerror = fail
    this.timer = setTimeout(fail, 5000)
    try {
      window.speechSynthesis.resume()
      window.speechSynthesis.speak(utterance)
    } catch {
      fail()
    }
  }
}

export const webSpeechService = new WebSpeechService()
