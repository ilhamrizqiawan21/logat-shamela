// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AITutorPanel } from './AITutorPanel'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let host: HTMLDivElement, root: Root
const book = { id: 1, name: 'Kitab', authors: '', category_id: 1, category: '' }
const page = { book_id: 1, page_id: 1, part: 1, printed_page: 1, book_name: '', authors: '', bookmarked: false, annotations: {}, tokens: [] }
const props = { enabled: true, provider: 'gemini', model: 'model-test', book, page, onClose: vi.fn(), onDraft: vi.fn() }
beforeEach(() => { host = document.createElement('div'); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); vi.unstubAllGlobals() })
it('names the active provider while loading and cancels the browser request on close', async () => {
  const fetchMock = vi.fn(() => new Promise(() => {})); vi.stubGlobal('fetch', fetchMock)
  await act(async () => root.render(<AITutorPanel {...props} />))
  await act(async () => { (host.querySelector('.ai-analyze') as HTMLButtonElement).click() })
  expect(host.querySelector('[role="status"]')!.textContent).toContain('Gemini sedang menganalisis')
  expect(host.textContent).not.toContain('Proses pertama')
  const signal = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal!
  act(() => root.render(null))
  expect(signal.aborted).toBe(true)
})
it('reports clipboard failure without claiming the answer was copied', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ answer: 'Makna', sections: [], source: { book_name: 'Kitab', page_id: 1 }, disclaimer: '' }) })))
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('denied') }) } })
  await act(async () => root.render(<AITutorPanel {...props} />))
  await act(async () => { (host.querySelector('.ai-analyze') as HTMLButtonElement).click() })
  await act(async () => { (host.querySelector('.ai-actions button') as HTMLButtonElement).click() })
  expect(host.querySelector('[role="alert"]')!.textContent).toContain('belum dapat disalin')
  expect(host.textContent).not.toContain('Tersalin')
})
it('offers no analysis action while AI is disabled', async () => {
  await act(async () => root.render(<AITutorPanel {...props} enabled={false} />))
  expect(host.querySelector('.ai-analyze')).toBeNull()
  expect(host.textContent).toContain('AI nonaktif')
})
