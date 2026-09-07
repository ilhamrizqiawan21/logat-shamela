import { afterEach, expect, it, vi } from 'vitest'
import { api } from './api'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('releases a stalled save with a recoverable error', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn((_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')))
  })))
  const saving = api.save(1, 1, { text: 'قال', index: 0, is_word: true, normalized: 'قال', prev_word: '', next_word: '', style: '' }, 'berkata')
  const assertion = expect(saving).rejects.toThrow('30 detik')
  await vi.advanceTimersByTimeAsync(30000)
  await assertion
})
